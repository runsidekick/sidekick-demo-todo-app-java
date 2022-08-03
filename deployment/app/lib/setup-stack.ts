import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eb from 'aws-cdk-lib/aws-elasticbeanstalk';
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

  sidekickSandboxSecurityGroupName: string;
  sidekickSandboxSecurityGroup: ec2.SecurityGroup;
  sidekickSandboxELBSecurityGroupId: string;

  sidekickSandboxRoleName: string;
  sidekickSandboxRole: iam.Role;
  sidekickSandboxPolicyName: string;
  sidekickSandboxPolicy: iam.ManagedPolicy;
  sidekickSandboxInstanceProfileName: string;
  sidekickSandboxInstanceProfile: iam.CfnInstanceProfile;

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

    // Create Sidekick Api Security Group

    this.sidekickSandboxSecurityGroupName = `sidekick-sandbox-sg-${process.env.STAGE}`;
    this.sidekickSandboxSecurityGroup = new ec2.SecurityGroup(this, this.sidekickSandboxSecurityGroupName, {
      securityGroupName: this.sidekickSandboxSecurityGroupName,
      description: `Sidekick Sandbox Security Group for ${process.env.STAGE} environment`,
      vpc: this.sidekickVPC,
      allowAllOutbound: true,
    });

    this.sidekickSandboxELBSecurityGroupId = cdk.Fn.importValue(`sidekick-sandbox-elb-sg-id-${process.env.STAGE}`);

    const sidekickSandboxELBSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, `lookup-sidekick-sandbox-elb-sg-${process.env.STAGE}`, this.sidekickSandboxELBSecurityGroupId);

    this.sidekickSandboxSecurityGroup.connections.allowFrom(sidekickSandboxELBSecurityGroup, ec2.Port.tcp(8080), 'Ingress HTTP connection from ELB');
    new cdk.CfnOutput(this, `sidekick-sandbox-sg-id-${process.env.STAGE}`, {
      value: this.sidekickSandboxSecurityGroup.securityGroupId,
      exportName: `sidekick-sandbox-sg-id-${process.env.STAGE}`,
    });

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Create Sidekick Api Role and Instance Profile

    this.sidekickSandboxRoleName = `sidekick-sandbox-role-${process.env.STAGE}`;
    this.sidekickSandboxRole = new iam.Role(this, this.sidekickSandboxRoleName, {
      roleName: this.sidekickSandboxRoleName,
      description: `Sidekick Api Role for ${process.env.STAGE} environment`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
    });

    this.sidekickSandboxPolicyName = `sidekick-sandbox-policy-${process.env.STAGE}`;
    this.sidekickSandboxPolicy = new iam.ManagedPolicy(this, this.sidekickSandboxPolicyName, {
      managedPolicyName: this.sidekickSandboxPolicyName,
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
            `arn:aws:s3:::sidekick-todo-app-${process.env.STAGE}/*`
          ],
        }),
      ],
    });
    new cdk.CfnOutput(this, `sidekick-sandbox-role-arn-${process.env.STAGE}`, {
      value: this.sidekickSandboxRole.roleArn,
      exportName: `sidekick-sandbox-role-arn-${process.env.STAGE}`,
    });

    this.sidekickSandboxRole.addManagedPolicy(this.sidekickSandboxPolicy);
    this.sidekickSandboxRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))

    this.sidekickSandboxInstanceProfileName = `sidekick-sandbox-role-${process.env.STAGE}`;
    this.sidekickSandboxInstanceProfile = new iam.CfnInstanceProfile(this, `sidekick-sandbox-instance-profile-${process.env.STAGE}`, {
      instanceProfileName: this.sidekickSandboxInstanceProfileName,
      path: '/',
      roles: [this.sidekickSandboxRole.roleName]
    });
    new cdk.CfnOutput(this, `sidekick-sandbox-instance-profile-arn-${process.env.STAGE}`, {
      value: this.sidekickSandboxInstanceProfile.attrArn,
      exportName: `sidekick-sandbox-instance-profile-arn-${process.env.STAGE}`,
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
     * Sidekick Sandbox Todo Java ElasticBeanstalk application should be owned by this stack
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
