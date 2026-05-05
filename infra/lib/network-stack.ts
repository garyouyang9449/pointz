import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly ec2SecurityGroup: ec2.SecurityGroup;
  public readonly rdsSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24
        },
        {
          name: "private-isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24
        }
      ]
    });

    this.ec2SecurityGroup = new ec2.SecurityGroup(this, "Ec2Sg", {
      vpc: this.vpc,
      description: "EC2 API host - inbound from CloudFront only",
      allowAllOutbound: true
    });

    // Allow inbound HTTP only from the CloudFront origin-facing IP ranges.
    this.ec2SecurityGroup.addIngressRule(
      ec2.Peer.prefixList("pl-82a045eb"), // com.amazonaws.global.cloudfront.origin-facing in us-west-1
      ec2.Port.tcp(80),
      "CloudFront origin-facing IPs only"
    );

    this.rdsSecurityGroup = new ec2.SecurityGroup(this, "RdsSg", {
      vpc: this.vpc,
      description: "RDS Postgres - inbound from EC2 SG only",
      allowAllOutbound: true
    });

    this.rdsSecurityGroup.addIngressRule(
      this.ec2SecurityGroup,
      ec2.Port.tcp(5432),
      "Postgres from API EC2"
    );

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
  }
}
