import * as cdk from 'aws-cdk-lib';
import * as eb from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { SetupStack } from './setup-stack';
import { Construct } from 'constructs';

const fs = require('fs');

export class DeployStack extends cdk.NestedStack {

  sidekickSandboxTodoJavaEBAppVersion: eb.CfnApplicationVersion;
  sidekickSandboxTodoJavaEBConfigurationTemplate: eb.CfnConfigurationTemplate;
  sidekickSandboxTodoJavaEBEnvironment: eb.CfnEnvironment;

  sidekickSandboxELBArn: string

  sidekickDatabaseAccessMarkerSecurityGroup: ec2.ISecurityGroup;
  sidekickCacheAccessMarkerSecurityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, setupStack: SetupStack, props?: cdk.NestedStackProps) {
    super(scope, id, props);
    super.stackName

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Create Sidekick Sandbox Todo Java EB Application Version

    this.sidekickSandboxTodoJavaEBAppVersion = new eb.CfnApplicationVersion(this, `${setupStack.sidekickSandboxTodoJavaEBAppName}-eb-app-version-${process.env.STAGE}`, {
      applicationName: setupStack.sidekickSandboxTodoJavaEBAppName,
      sourceBundle: {
        s3Bucket: `${process.env.ARTIFACT_S3_BUCKET}`,
        s3Key: `${process.env.ARTIFACT_S3_KEY}`,
      },
    });

    new cdk.CfnOutput(this, `sidekick-sandbox-todo-java-eb-app-version-label-${process.env.STAGE}`, {
      value: this.sidekickSandboxTodoJavaEBAppVersion.ref,
      exportName: `sidekick-sandbox-todo-java-eb-app-version-label-${process.env.STAGE}`,
    });

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Lookup Sidekick Security Groups
    this.sidekickDatabaseAccessMarkerSecurityGroup = ec2.SecurityGroup.fromLookupByName(
        this,
        `lookup-sidekick-db-access-marker-sg-${process.env.STAGE}`,
        `sidekick-db-access-marker-sg-${process.env.STAGE}`,
        setupStack.sidekickSandboxVPC);

    this.sidekickCacheAccessMarkerSecurityGroup = ec2.SecurityGroup.fromLookupByName(
        this,
        `lookup-sidekick-cache-access-marker-sg-${process.env.STAGE}`,
        `sidekick-cache-access-marker-sg-${process.env.STAGE}`,
        setupStack.sidekickSandboxVPC);

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Create Sidekick Sandbox Todo Java EB Configuration Template

    // Get properties from setup stack as local variable to be able to bind them into loaded option settings
    const sidekickSandboxVPCId = setupStack.defaultVPC.vpcId;
    const sidekickSandboxVPCPublicSubnets = setupStack.defaultVPC.publicSubnets.map((value: any) => value.subnetId).join(',');
    const sidekickSandboxVPCPrivateSubnets = setupStack.defaultVPC.privateSubnets.map((value: any) => value.subnetId).join(',');
    const sidekickDatabaseAccessMarkerSecurityGroupId = this.sidekickDatabaseAccessMarkerSecurityGroup.securityGroupId;
    const sidekickCacheAccessMarkerSecurityGroupId = this.sidekickCacheAccessMarkerSecurityGroup.securityGroupId;
    const sidekickSandboxInstanceProfileName = setupStack.sidekickSandboxInstanceProfileName;
    const sidekickSandboxSecurityGroupId = setupStack.sidekickSandboxSecurityGroup.securityGroupId;
    const sidekickSandboxELBSecurityGroupId = setupStack.sidekickSandboxELBSecurityGroupId;

    this.sidekickSandboxELBArn = cdk.Fn.importValue(`sidekick-sandbox-elb-arn-${process.env.STAGE}`);

    const sidekickSandboxELB: elbv2.IApplicationLoadBalancer = elbv2.ApplicationLoadBalancer.fromApplicationLoadBalancerAttributes(this,
        `lookup-sidekick-sandbox-elb-${process.env.STAGE}`,
        {
          loadBalancerArn: this.sidekickSandboxELBArn.toString(),
          securityGroupId: sidekickSandboxELBSecurityGroupId,
          vpc: setupStack.defaultVPC
        }
    );

    const rawOptionSettings = fs.readFileSync('../eb-option-settings.json', 'utf8');
    const processedOptionSettings = rawOptionSettings.replace(/\${(.*?)}/g, (x: string, g: any) => eval(g));
    const sidekickSandboxTodoJavaEBOptionSettings = eval(processedOptionSettings);

    this.sidekickSandboxTodoJavaEBConfigurationTemplate = new eb.CfnConfigurationTemplate(this, `${setupStack.sidekickSandboxTodoJavaEBAppName}-eb-config-template-${process.env.STAGE}`, {
      applicationName: setupStack.sidekickSandboxTodoJavaEBAppName,
      solutionStackName: `${process.env.LATEST_SOLUTION_STACK_NAME}`,
      optionSettings: sidekickSandboxTodoJavaEBOptionSettings,
    });

    this.sidekickSandboxTodoJavaEBConfigurationTemplate.node.addDependency(setupStack.sidekickSandboxInstanceProfile);
    this.sidekickSandboxTodoJavaEBConfigurationTemplate.node.addDependency(setupStack.sidekickSandboxSecurityGroup);
    this.sidekickSandboxTodoJavaEBConfigurationTemplate.node.addDependency(sidekickSandboxELB);

    new cdk.CfnOutput(this, `sidekick-sandbox-todo-java-eb-config-template-name-${process.env.STAGE}`, {
      value: this.sidekickSandboxTodoJavaEBConfigurationTemplate.ref,
      exportName: `sidekick-sandbox-todo-java-eb-config-template-name-${process.env.STAGE}`,
    });

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Create Sidekick Sandbox Todo Java EB Environment

    this.sidekickSandboxTodoJavaEBEnvironment = new eb.CfnEnvironment(this, setupStack.sidekickSandboxTodoJavaEBEnvironmentName, {
      applicationName: setupStack.sidekickSandboxTodoJavaEBAppName,
      cnamePrefix: setupStack.sidekickSandboxTodoJavaEBEnvironmentName,
      environmentName: setupStack.sidekickSandboxTodoJavaEBEnvironmentName,
      templateName: this.sidekickSandboxTodoJavaEBConfigurationTemplate.ref,
      versionLabel: this.sidekickSandboxTodoJavaEBAppVersion.ref,
    });

    this.sidekickSandboxTodoJavaEBEnvironment.addDependsOn(this.sidekickSandboxTodoJavaEBConfigurationTemplate);
    this.sidekickSandboxTodoJavaEBEnvironment.addDependsOn(this.sidekickSandboxTodoJavaEBAppVersion);

    new cdk.CfnOutput(this, `sidekick-sandbox-todo-java-eb-environment-name-${process.env.STAGE}`, {
      value: setupStack.sidekickSandboxTodoJavaEBEnvironmentName,
      exportName: `sidekick-sandbox-todo-java-eb-environment-name-${process.env.STAGE}`,
    });
  }
}
