import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface CicdStackProps extends cdk.StackProps {
  githubOwner: string;
  githubRepo: string;
  ecrRepository: ecr.IRepository;
  spaBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
  ec2Instance: ec2.IInstance;
}

export class CicdStack extends cdk.Stack {
  public readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    // Reuse account-level GitHub OIDC provider if present, else create.
    // CDK doesn't have a "fromAccountIfExists" for this; we create it and
    // accept that subsequent stacks should use `OpenIdConnectProvider.fromOpenIdConnectProviderArn`.
    const provider = new iam.OpenIdConnectProvider(this, "GitHubOidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"]
    });

    const subjectClaim = `repo:${props.githubOwner}/${props.githubRepo}:ref:refs/heads/main`;

    this.deployRole = new iam.Role(this, "GitHubDeployRole", {
      roleName: "pointz-github-deployer",
      assumedBy: new iam.FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": subjectClaim
          }
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Assumed by GitHub Actions in garyouyang9449/pointz@main"
    });

    // ECR push
    props.ecrRepository.grantPullPush(this.deployRole);
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"]
      })
    );

    // S3 sync (SPA)
    props.spaBucket.grantReadWrite(this.deployRole);
    props.spaBucket.grantDelete(this.deployRole);

    // CloudFront invalidation
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:ListInvalidations"
        ],
        resources: [
          `arn:aws:cloudfront::${this.account}:distribution/${props.distribution.distributionId}`
        ]
      })
    );

    // SSM SendCommand to the EC2 instance to redeploy server
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:SendCommand"],
        resources: [
          `arn:aws:ec2:${this.region}:${this.account}:instance/${props.ec2Instance.instanceId}`,
          `arn:aws:ssm:${this.region}::document/AWS-RunShellScript`
        ]
      })
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "ssm:GetCommandInvocation",
          "ssm:ListCommandInvocations",
          "ssm:ListCommands"
        ],
        resources: ["*"]
      })
    );

    // CDK deploy permissions (broad; required so Actions can run `cdk deploy`)
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`]
      })
    );

    new cdk.CfnOutput(this, "DeployRoleArn", { value: this.deployRole.roleArn });
    new cdk.CfnOutput(this, "GithubSubjectClaim", { value: subjectClaim });
  }
}
