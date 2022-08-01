import * as cdk from 'aws-cdk-lib';
import * as eb from 'aws-cdk-lib/aws-elasticbeanstalk';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as alias from 'aws-cdk-lib/aws-route53-targets';
import { SetupStack } from './setup-stack';
import { Construct } from 'constructs';

const fs = require('fs');

export class DeployStack extends cdk.NestedStack {

  sidekickSandboxTodoJavaEBAppVersion: eb.CfnApplicationVersion;
  sidekickSandboxTodoJavaEBConfigurationTemplate: eb.CfnConfigurationTemplate;
  sidekickSandboxTodoJavaEBEnvironment: eb.CfnEnvironment;

  sidekickSandboxELBArn: string

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
    const sidekickVPCId = setupStack.sidekickVPC.vpcId;
    const sidekickVPCPublicSubnets = setupStack.sidekickVPC.publicSubnets.map((value: any) => value.subnetId).join(',');
    const sidekickVPCPrivateSubnets = setupStack.sidekickVPC.privateSubnets.map((value: any) => value.subnetId).join(',');
    const sidekickSandboxTodoJavaInstanceProfileName = setupStack.sidekickSandboxTodoJavaInstanceProfileName;
    const sidekickSandboxTodoJavaSecurityGroupId = setupStack.sidekickSandboxTodoJavaSecurityGroup.securityGroupId;
    const sidekickSandboxELBSecurityGroupId = setupStack.sidekickSandboxELBSecurityGroupId;

    this.sidekickSandboxELBArn = cdk.Fn.importValue(`sidekick-sandbox-elb-arn-${process.env.STAGE}`);

    const sidekickSandboxELB: elbv2.IApplicationLoadBalancer = elbv2.ApplicationLoadBalancer.fromApplicationLoadBalancerAttributes(this,
      `lookup-sidekick-sandbox-elb-${process.env.STAGE}`,
      {
        loadBalancerArn: this.sidekickSandboxELBArn.toString(),
        securityGroupId: sidekickSandboxELBSecurityGroupId,
        vpc: setupStack.sidekickVPC
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


    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Route53 A Record Redirect
    //
    new route53.ARecord(this,`sidekick-sandbox-elb-dns-a-record-${process.env.STAGE}`, {
      zone: setupStack.sidekickSandboxZone,
      recordName: `*.${process.env.SANDBOX_SUBDOMAIN_NAME}`,
      target: route53.RecordTarget.fromAlias(new alias.LoadBalancerTarget(sidekickSandboxELB))
    });
  }
}
