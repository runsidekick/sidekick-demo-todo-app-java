import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eb from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as route53 from 'aws-cdk-lib/aws-route53';
import {
  ApplicationDescription,
} from "aws-sdk/clients/elasticbeanstalk";
import { Construct } from 'constructs';

const AWS = require('aws-sdk');
const ebClient = new AWS.ElasticBeanstalk({
  region: process.env.CDK_DEFAULT_REGION
});

export class SetupStack extends cdk.NestedStack {

  logicalStackName: string;

  sidekickVPC: ec2.IVpc;

  sidekickSandboxZone: route53.HostedZone;

  sidekickSandboxTodoJavaSecurityGroupName: string;
  sidekickSandboxTodoJavaSecurityGroup: ec2.SecurityGroup;
  sidekickSandboxELBSecurityGroupId: string;

  sidekickSandboxTodoJavaRoleName: string;
  sidekickSandboxTodoJavaRole: iam.Role;
  sidekickSandboxTodoJavaPolicyName: string;
  sidekickSandboxTodoJavaPolicy: iam.ManagedPolicy;
  sidekickSandboxTodoJavaInstanceProfileName: string;
  sidekickSandboxTodoJavaInstanceProfile: iam.CfnInstanceProfile;

  sidekickSandboxTodoJavaEBAppName: string;
  sidekickSandboxTodoJavaEBApp: eb.CfnApplication;
  sidekickSandboxTodoJavaEBEnvironmentName: string;

  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);
    this.logicalStackName = id;
  }

  async create() {
    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Get Sidekick VPC

    this.sidekickVPC = ec2.Vpc.fromLookup(this, `lookup-sidekick-vpc-${process.env.STAGE}`, {
      vpcName: `sidekick-vpc-${process.env.STAGE}`,
    });

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Get Sidekick Zone

    this.sidekickSandboxZone = route53.HostedZone.fromLookup(this,`sidekick-sandbox-zone-${process.env.STAGE}`, {
      domainName: `${process.env.DOMAIN_NAME}`
    });

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Create Sidekick Sandbox Todo Java Security Group

    this.sidekickSandboxTodoJavaSecurityGroupName = `sidekick-sandbox-todo-java-sg-${process.env.STAGE}`;
    this.sidekickSandboxTodoJavaSecurityGroup = new ec2.SecurityGroup(this, this.sidekickSandboxTodoJavaSecurityGroupName, {
      securityGroupName: this.sidekickSandboxTodoJavaSecurityGroupName,
      description: `Sidekick Sandbox Todo Java Security Group for ${process.env.STAGE} environment`,
      vpc: this.sidekickVPC,
      allowAllOutbound: true,
    });

    this.sidekickSandboxELBSecurityGroupId = cdk.Fn.importValue(`sidekick-sandbox-elb-sg-id-${process.env.STAGE}`);

    const sidekickSandboxELBSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, `lookup-sidekick-sandbox-elb-sg-${process.env.STAGE}`, this.sidekickSandboxELBSecurityGroupId);

    this.sidekickSandboxTodoJavaSecurityGroup.connections.allowFrom(sidekickSandboxELBSecurityGroup, ec2.Port.tcp(8080), 'Ingress HTTP connection from ELB');
    new cdk.CfnOutput(this, `sidekick-sandbox-todo-java-sg-id-${process.env.STAGE}`, {
      value: this.sidekickSandboxTodoJavaSecurityGroup.securityGroupId,
      exportName: `sidekick-sandbox-todo-java-sg-id-${process.env.STAGE}`,
    });

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Create Sidekick Sandbox Todo Java Role and Instance Profile

    this.sidekickSandboxTodoJavaRoleName = `sidekick-sandbox-todo-java-role-${process.env.STAGE}`;
    this.sidekickSandboxTodoJavaRole = new iam.Role(this, this.sidekickSandboxTodoJavaRoleName, {
      roleName: this.sidekickSandboxTodoJavaRoleName,
      description: `Sidekick Sandbox Todo Java Role for ${process.env.STAGE} environment`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    this.sidekickSandboxTodoJavaPolicyName = `sidekick-sandbox-todo-java-policy-${process.env.STAGE}`;
    this.sidekickSandboxTodoJavaPolicy = new iam.ManagedPolicy(this, this.sidekickSandboxTodoJavaPolicyName, {
      managedPolicyName: this.sidekickSandboxTodoJavaPolicyName,
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'elasticbeanstalk:PutInstanceStatistics',
          ],
          resources: [
            `arn:aws:elasticbeanstalk:*:*:environment/sidekick-sandbox-todo-java-${process.env.STAGE}*`
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: [
            `arn:aws:logs:*:*:log-group:/aws/elasticbeanstalk/sidekick-sandbox-todo-java-${process.env.STAGE}*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:Get*',
            's3:List*',
          ],
          resources: [
            `arn:aws:s3:::sidekick-releases-${process.env.STAGE}/agents/*`
          ],
        }),
      ],
    });
    new cdk.CfnOutput(this, `sidekick-sandbox-todo-java-role-arn-${process.env.STAGE}`, {
      value: this.sidekickSandboxTodoJavaRole.roleArn,
      exportName: `sidekick-sandbox-todo-java-role-arn-${process.env.STAGE}`,
    });

    this.sidekickSandboxTodoJavaRole.addManagedPolicy(this.sidekickSandboxTodoJavaPolicy);
    this.sidekickSandboxTodoJavaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))

    this.sidekickSandboxTodoJavaInstanceProfileName = `sidekick-sandbox-todo-java-role-${process.env.STAGE}`;
    this.sidekickSandboxTodoJavaInstanceProfile = new iam.CfnInstanceProfile(this, `sidekick-sandbox-todo-java-instance-profile-${process.env.STAGE}`, {
      instanceProfileName: this.sidekickSandboxTodoJavaInstanceProfileName,
      path: '/',
      roles: [this.sidekickSandboxTodoJavaRole.roleName]
    });
    new cdk.CfnOutput(this, `sidekick-sandbox-todo-java-instance-profile-arn-${process.env.STAGE}`, {
      value: this.sidekickSandboxTodoJavaInstanceProfile.attrArn,
      exportName: `sidekick-sandbox-todo-java-instance-profile-arn-${process.env.STAGE}`,
    });

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Create Sidekick Sandbox Todo Java EB Application

    this.sidekickSandboxTodoJavaEBAppName = 'sidekick-sandbox-todo-java';
    const sidekickSandboxTodoJavaEBAppDescription = `Sidekick Sandbox Todo Java App (owned by CF Stack ${this.logicalStackName}`;
    const describeApplicationsResponse = await ebClient.describeApplications({
      ApplicationNames: [this.sidekickSandboxTodoJavaEBAppName]
    }).promise();
    const existingSidekickSandboxTodoJavaEBApp = describeApplicationsResponse.Applications.find((appDesc: ApplicationDescription) => {
      return appDesc.ApplicationName === this.sidekickSandboxTodoJavaEBAppName;
    });

    /*
     * SidekickSandboxTodoJava ElasticBeanstalk application should be owned by this stack
     * - if it is not exist
     * - or if it is exist and created by this stack
     *
     * Here we are using "Description" property to put metadata to be used later
     * for distinguishing whether or not ElasticBeanstalk application is created by this stack.
     * Unfortunately we follow such hacky workaround as ElasticBeanstalk application tags
     * are not supported over CloudFormation but API/AWS SDK
     */

    const ownSidekickSandboxTodoJavaEBApp: boolean =
      !existingSidekickSandboxTodoJavaEBApp ||
      (existingSidekickSandboxTodoJavaEBApp && existingSidekickSandboxTodoJavaEBApp.Description === sidekickSandboxTodoJavaEBAppDescription);
    if (ownSidekickSandboxTodoJavaEBApp) {
      this.sidekickSandboxTodoJavaEBApp = new eb.CfnApplication(this, this.sidekickSandboxTodoJavaEBAppName, {
        applicationName: this.sidekickSandboxTodoJavaEBAppName,
        description: sidekickSandboxTodoJavaEBAppDescription,
      });
    }

    this.sidekickSandboxTodoJavaEBEnvironmentName = `${this.sidekickSandboxTodoJavaEBAppName}-${process.env.STAGE}`;
  }
}
