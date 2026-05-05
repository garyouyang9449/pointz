#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DataStack } from "../lib/data-stack";
import { AppStack } from "../lib/app-stack";
import { CicdStack } from "../lib/cicd-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? "248785326709",
  region: process.env.CDK_DEFAULT_REGION ?? "us-west-1"
};

const network = new NetworkStack(app, "PointzNetworkStack", { env });

const data = new DataStack(app, "PointzDataStack", {
  env,
  vpc: network.vpc,
  rdsSecurityGroup: network.rdsSecurityGroup
});

const appStack = new AppStack(app, "PointzAppStack", {
  env,
  vpc: network.vpc,
  ec2SecurityGroup: network.ec2SecurityGroup,
  ecrRepository: data.ecrRepository,
  dbSecret: data.dbSecret,
  dbInstance: data.dbInstance,
  jwtSecretParamName: data.jwtSecretParamName
});

new CicdStack(app, "PointzCicdStack", {
  env,
  githubOwner: "garyouyang9449",
  githubRepo: "pointz",
  ecrRepository: data.ecrRepository,
  spaBucket: appStack.spaBucket,
  distribution: appStack.distribution,
  ec2Instance: appStack.instance
});

app.synth();
