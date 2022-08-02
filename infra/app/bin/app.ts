#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import { SandboxELBStack } from '../lib/elb/sandbox-elb-stack';

const result = require('dotenv').config({ path: `../${process.env.PROFILE}/.env` });
if (result.error) {
    throw result.error;
}

const app = new cdk.App();

const props = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    },
};

const mainStack = new Stack(app, `sidekick-sandbox-setup-stack-${process.env.STAGE}`, props);

////////////////////////////////////////////////////////////////////////////////
//
// ELB Stack
//
new SandboxELBStack(mainStack, `sidekick-sandbox-elb-stack-${process.env.STAGE}`, {});