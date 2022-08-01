#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as alias from 'aws-cdk-lib/aws-route53-targets';
import {Stack} from "aws-cdk-lib";

const result = require('dotenv').config({path: `../${process.env.PROFILE}/.env`});
if (result.error) {
    throw result.error;
}

async function createApp() {
    const app = new cdk.App();
    const props = {
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: process.env.CDK_DEFAULT_REGION
        },
    };

    // Create main stack
    const mainStack = new Stack(app, `sidekick-sandbox-setup-stack-${process.env.STAGE}`, props);

    let sidekickVPC = ec2.Vpc.fromLookup(mainStack, `lookup-sidekick-vpc-${process.env.STAGE}`, {
        vpcName: `sidekick-vpc-${process.env.STAGE}`,
    });

    const sidekickServiceELBSecurityGroupId = cdk.Fn.importValue(`sidekick-service-elb-sg-id-${process.env.STAGE}`);

    const sidekickServiceELBSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(mainStack, `lookup-sidekick-service-elb-sg-${process.env.STAGE}`, sidekickServiceELBSecurityGroupId);

    const sidekickServiceZone = route53.HostedZone.fromLookup(mainStack,`sidekick-sandbox-zone-${process.env.STAGE}`, {
        domainName: `${process.env.DOMAIN_NAME}`
    });

    const sidekickServiceELB = new elbv2.ApplicationLoadBalancer(mainStack, `sidekick-sandbox-elb-${process.env.STAGE}`, {
        loadBalancerName: `sidekick-sandbox-elb-${process.env.STAGE}`,
        vpc: sidekickVPC,
        securityGroup: sidekickServiceELBSecurityGroup,
        vpcSubnets: sidekickVPC.selectSubnets({ onePerAz: true, subnetType: ec2.SubnetType.PUBLIC }),
        internetFacing: true,
        idleTimeout: cdk.Duration.minutes(5),
    });

    ////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Route53 A Record Redirect
    //
    new route53.ARecord(mainStack,`sidekick-sandbox-elb-dns-a-record-${process.env.STAGE}`, {
        zone: sidekickServiceZone,
        recordName: `*.${process.env.SANDBOX_SUBDOMAIN_NAME}`,
        target: route53.RecordTarget.fromAlias(new alias.LoadBalancerTarget(sidekickServiceELB))
    });

}

createApp();
