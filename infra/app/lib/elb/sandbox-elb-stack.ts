import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as alias from 'aws-cdk-lib/aws-route53-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export class SandboxELBStack extends cdk.NestedStack {

  sidekickVPC: ec2.IVpc;

  sidekickSandboxZone: route53.IHostedZone;
  sidekickSandboxCertificate: acm.DnsValidatedCertificate;

  sidekickSandboxELB: elbv2.ApplicationLoadBalancer;
  sidekickSandboxELBListener: elbv2.ApplicationListener;

  sidekickSandboxELBSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: cdk.NestedStackProps) {
    super(scope, id, props);

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // VPC
    //
    this.sidekickVPC = ec2.Vpc.fromLookup(this, `lookup-sidekick-vpc-${process.env.STAGE}`, {
      vpcName: `sidekick-vpc-${process.env.STAGE}`,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Certificates
    //
    this.sidekickSandboxZone = route53.HostedZone.fromLookup(this, `sidekick-service-zone-${process.env.STAGE}`, {
      domainName: `${process.env.DOMAIN_NAME}`
    });

    this.sidekickSandboxCertificate = new acm.DnsValidatedCertificate(this, `sidekick-sandbox-certificate-${process.env.STAGE}`, {
      domainName: `${process.env.SANDBOX_SUBDOMAIN_NAME}.${process.env.DOMAIN_NAME}`,
      subjectAlternativeNames: [`*.${process.env.SANDBOX_SUBDOMAIN_NAME}.${process.env.DOMAIN_NAME}`],
      hostedZone: this.sidekickSandboxZone,
      region: this.region
    });

    new cdk.CfnOutput(this, `sidekick-sandbox-certificate-arn-${process.env.STAGE}`, {
      value: this.sidekickSandboxCertificate.certificateArn,
      exportName: `sidekick-sandbox-certificate-arn-${process.env.STAGE}`,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // ELB Security Groups
    //
    this.sidekickSandboxELBSecurityGroup = new ec2.SecurityGroup(this, `sidekick-sandbox-elb-sg-${process.env.STAGE}`, {
      securityGroupName: `sidekick-sandbox-elb-sg-${process.env.STAGE}`,
      description: `Sidekick Sandbox ELB Security Group for ${process.env.STAGE} environment`,
      vpc: this.sidekickVPC,
      allowAllOutbound: true,
    });

    this.sidekickSandboxELBSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));

    new cdk.CfnOutput(this, `sidekick-sandbox-elb-sg-id-${process.env.STAGE}`, {
      value: this.sidekickSandboxELBSecurityGroup.securityGroupId,
      exportName: `sidekick-sandbox-elb-sg-id-${process.env.STAGE}`,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // ELB
    //
    this.sidekickSandboxELB = new elbv2.ApplicationLoadBalancer(this, `sidekick-sandbox-elb-${process.env.STAGE}`, {
      loadBalancerName: `sidekick-sandbox-elb-${process.env.STAGE}`,
      vpc: this.sidekickVPC,
      securityGroup: this.sidekickSandboxELBSecurityGroup,
      vpcSubnets: this.sidekickVPC.selectSubnets({ onePerAz: true, subnetType: ec2.SubnetType.PUBLIC }),
      internetFacing: true,
      idleTimeout: cdk.Duration.minutes(5),
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // ELB Listeners
    //
    this.sidekickSandboxELB.addListener(`sidekick-sandbox-elb-http-listener-${process.env.STAGE}`, {
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: "HTTPS",
        port: "443",
        host: "#{host}",
        path: "/#{path}",
        query: "#{query}",
        permanent: true,
      }),
    });

    this.sidekickSandboxELBListener = this.sidekickSandboxELB.addListener(`sidekick-sandbox-elb-https-listener-${process.env.STAGE}`, {
      protocol: elbv2.ApplicationProtocol.HTTPS,
      port: 443,
      defaultAction: elbv2.ListenerAction.fixedResponse(404),
      certificates: [
        this.sidekickSandboxCertificate
      ],
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // SSM Exports
    //
    new ssm.StringParameter(this, `sidekick-sandbox-elb-listener-ssm-${process.env.STAGE}`, {
      parameterName: `/sidekick/${process.env.STAGE}/common/infra/sandbox.elb.listener.arn`,
      stringValue: this.sidekickSandboxELBListener.listenerArn.toString(),
    })

    new cdk.CfnOutput(this, `sidekick-sandbox-elb-arn-${process.env.STAGE}`, {
      value: this.sidekickSandboxELB.loadBalancerArn,
      exportName: `sidekick-sandbox-elb-arn-${process.env.STAGE}`,
    });

    new cdk.CfnOutput(this, `sidekick-sandbox-elb-dns-${process.env.STAGE}`, {
      value: this.sidekickSandboxELB.loadBalancerDnsName,
      exportName: `sidekick-sandbox-elb-dns-${process.env.STAGE}`,
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Route53 A Record Redirect
    //
    new route53.ARecord(this, `sidekick-sandbox-elb-dns-a-record-${process.env.STAGE}`, {
      zone: this.sidekickSandboxZone,
      recordName: `*.${process.env.SANDBOX_SUBDOMAIN_NAME}`,
      target: route53.RecordTarget.fromAlias(new alias.LoadBalancerTarget(this.sidekickSandboxELB))
    });
  }
}
