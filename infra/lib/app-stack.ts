import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface AppStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  ec2SecurityGroup: ec2.ISecurityGroup;
  ecrRepository: ecr.IRepository;
  dbSecret: secretsmanager.ISecret;
  dbInstance: rds.IDatabaseInstance;
  jwtSecretParamName: string;
}

export class AppStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly distribution: cloudfront.Distribution;
  public readonly elasticIp: ec2.CfnEIP;
  public readonly spaBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    // --- S3 (SPA) ---
    this.spaBucket = new s3.Bucket(this, "SpaBucket", {
      bucketName: `pointz-spa-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // --- IAM role for EC2 ---
    const role = new iam.Role(this, "Ec2Role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "CloudWatchAgentServerPolicy"
        )
      ]
    });
    props.ecrRepository.grantPull(role);
    props.dbSecret.grantRead(role);
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/pointz/*`
        ]
      })
    );

    // --- User data ---
    const ecrRegistry = `${this.account}.dkr.ecr.${this.region}.amazonaws.com`;
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "set -euxo pipefail",
      "dnf update -y",
      "dnf install -y docker jq",
      // AWS CLI v2 (package name is 'awscli-2' on AL2023; fallback to bundled installer)
      "dnf install -y awscli-2 || (curl -sSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip && (dnf install -y unzip || true) && unzip -q /tmp/awscliv2.zip -d /tmp && /tmp/aws/install)",
      "systemctl enable --now docker",
      "usermod -a -G docker ec2-user",
      // install docker compose plugin
      "mkdir -p /usr/local/lib/docker/cli-plugins",
      "curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose",
      "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
      "mkdir -p /opt/pointz",
      `cat > /opt/pointz/render-env.sh <<'EOF'
#!/bin/bash
set -euxo pipefail
REGION="${this.region}"
DB_SECRET_ARN="${props.dbSecret.secretArn}"
JWT_PARAM_NAME="${props.jwtSecretParamName}"

DB_JSON=$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$DB_SECRET_ARN" --query SecretString --output text)
DB_USER=$(echo "$DB_JSON" | jq -r .username)
DB_PASS=$(echo "$DB_JSON" | jq -r .password)
DB_HOST=$(echo "$DB_JSON" | jq -r .host)
DB_PORT=$(echo "$DB_JSON" | jq -r .port)
DB_NAME=$(echo "$DB_JSON" | jq -r .dbname)
JWT_SECRET=$(aws ssm get-parameter --region "$REGION" --name "$JWT_PARAM_NAME" --with-decryption --query Parameter.Value --output text)

cat > /opt/pointz/.env <<ENV
DATABASE_URL=postgres://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME
JWT_SECRET=$JWT_SECRET
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
ENV
EOF`,
      "chmod +x /opt/pointz/render-env.sh",
      `cat > /opt/pointz/docker-compose.yml <<EOF
services:
  api:
    image: ${ecrRegistry}/${props.ecrRepository.repositoryName}:latest
    restart: unless-stopped
    env_file:
      - /opt/pointz/.env
    ports:
      - "80:3000"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
EOF`,
      `cat > /etc/systemd/system/pointz.service <<'EOF'
[Unit]
Description=Pointz API stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/pointz
ExecStartPre=/opt/pointz/render-env.sh
ExecStartPre=/bin/bash -lc 'aws ecr get-login-password --region ${this.region} | docker login --username AWS --password-stdin ${ecrRegistry}'
ExecStartPre=/usr/bin/docker compose pull
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
EOF`,
      "systemctl daemon-reload",
      "systemctl enable pointz.service",
      "systemctl start pointz.service || true"
    );

    // --- EC2 instance ---
    this.instance = new ec2.Instance(this, "ApiHost", {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.resolveSsmParameterAtLaunch(
        "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
      ),
      securityGroup: props.ec2SecurityGroup,
      role,
      userData,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(8, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true
          })
        }
      ]
    });
    this.instance.node.addDependency(props.dbInstance);

    // --- Elastic IP for stable origin DNS ---
    this.elasticIp = new ec2.CfnEIP(this, "ApiEip", {
      domain: "vpc",
      instanceId: this.instance.instanceId
    });

    // The EC2 public DNS name (built from the EIP). Format:
    // ec2-<dash-ip>.<region>.compute.amazonaws.com
    const dashIp = cdk.Fn.join("-", cdk.Fn.split(".", this.elasticIp.ref));
    const ec2PublicDns = `ec2-${dashIp}.${this.region}.compute.amazonaws.com`;

    // --- CloudFront ---
    const oac = new cloudfront.S3OriginAccessControl(this, "SpaOac", {
      signing: cloudfront.Signing.SIGV4_ALWAYS
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(
      this.spaBucket,
      { originAccessControl: oac }
    );

    const apiOrigin = new origins.HttpOrigin(ec2PublicDns, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 80
    });

    this.distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: "Pointz SPA + API",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true
      },
      additionalBehaviors: {
        "/api/*": {
          origin: apiOrigin,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: true
        }
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(0)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.minutes(0)
        }
      ]
    });

    new cdk.CfnOutput(this, "InstanceId", { value: this.instance.instanceId });
    new cdk.CfnOutput(this, "ElasticIp", { value: this.elasticIp.ref });
    new cdk.CfnOutput(this, "Ec2PublicDns", { value: ec2PublicDns });
    new cdk.CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId
    });
    new cdk.CfnOutput(this, "PublicUrl", {
      value: `https://${this.distribution.distributionDomainName}`
    });
  }
}
