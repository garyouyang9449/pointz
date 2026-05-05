import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as crypto from "crypto";

export interface DataStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  rdsSecurityGroup: ec2.ISecurityGroup;
}

export class DataStack extends cdk.Stack {
  public readonly ecrRepository: ecr.Repository;
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly dbSecret: secretsmanager.ISecret;
  public readonly jwtSecretParamName: string;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    // --- ECR ---
    this.ecrRepository = new ecr.Repository(this, "ServerRepo", {
      repositoryName: "pointz-server",
      imageScanOnPush: true,
      lifecycleRules: [{ maxImageCount: 10 }],
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // --- RDS Postgres ---
    this.dbInstance = new rds.DatabaseInstance(this, "Postgres", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE4_GRAVITON,
        ec2.InstanceSize.MICRO
      ),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.rdsSecurityGroup],
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      databaseName: "pointz",
      credentials: rds.Credentials.fromGeneratedSecret("pointz", {
        secretName: "pointz/db"
      }),
      multiAz: false,
      publiclyAccessible: false,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoMinorVersionUpgrade: true
    });
    this.dbSecret = this.dbInstance.secret!;

    // --- SSM JWT secret ---
    // Note: SecureString cannot be created directly via CloudFormation in plain CDK
    // without a custom resource. We create a String parameter with a generated value,
    // and the EC2 role has permission to read it. For higher security, swap to
    // Secrets Manager later.
    const jwtSecretValue = crypto.randomBytes(48).toString("hex");
    const jwtParam = new ssm.StringParameter(this, "JwtSecret", {
      parameterName: "/pointz/jwt-secret",
      stringValue: jwtSecretValue,
      tier: ssm.ParameterTier.STANDARD,
      description: "Pointz API JWT signing secret"
    });
    this.jwtSecretParamName = jwtParam.parameterName;

    new cdk.CfnOutput(this, "EcrRepoUri", { value: this.ecrRepository.repositoryUri });
    new cdk.CfnOutput(this, "DbSecretArn", { value: this.dbSecret.secretArn });
    new cdk.CfnOutput(this, "DbEndpoint", {
      value: this.dbInstance.dbInstanceEndpointAddress
    });
  }
}
