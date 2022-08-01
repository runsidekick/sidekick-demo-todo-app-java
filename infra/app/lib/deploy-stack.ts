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

  sidekickServiceELBArn: string

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

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // Create Sidekick Sandbox Todo Java EB Configuration Template

    // Get properties from setup stack as local variable to be able to bind them into loaded option settings
    const sidekickSandboxTodoJavaVPCId = setupStack.sidekickSandboxTodoJavaVPC.vpcId;
    const sidekickSandboxTodoJavaVPCPublicSubnets = setupStack.sidekickSandboxTodoJavaVPC.publicSubnets.map((value: any) => value.subnetId).join(',');
    const sidekickSandboxTodoJavaVPCPrivateSubnets = setupStack.sidekickSandboxTodoJavaVPC.privateSubnets.map((value: any) => value.subnetId).join(',');
    const sidekickSandboxTodoJavaInstanceProfileName = setupStack.sidekickSandboxTodoJavaInstanceProfileName;
    const sidekickSandboxTodoJavaSecurityGroupId = setupStack.sidekickSandboxTodoJavaSecurityGroup.securityGroupId;
    const sidekickServiceELBSecurityGroupId = setupStack.sidekickServiceELBSecurityGroupId;

    this.sidekickServiceELBArn = cdk.Fn.importValue(`sidekick-service-elb-arn-${process.env.STAGE}`);

    const sidekickServiceELB: elbv2.IApplicationLoadBalancer = elbv2.ApplicationLoadBalancer.fromApplicationLoadBalancerAttributes(this,
      `lookup-sidekick-service-elb-${process.env.STAGE}`,
      {
        loadBalancerArn: this.sidekickServiceELBArn.toString(),
        securityGroupId: sidekickServiceELBSecurityGroupId,
        vpc: setupStack.sidekickSandboxTodoJavaVPC
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

    this.sidekickSandboxTodoJavaEBConfigurationTemplate.node.addDependency(setupStack.sidekickSandboxTodoJavaInstanceProfile);
    this.sidekickSandboxTodoJavaEBConfigurationTemplate.node.addDependency(setupStack.sidekickSandboxTodoJavaSecurityGroup);
    this.sidekickSandboxTodoJavaEBConfigurationTemplate.node.addDependency(sidekickServiceELB);

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
