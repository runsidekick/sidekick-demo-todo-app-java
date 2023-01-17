#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import { SandboxELBStack } from '../lib/elb/sandbox-elb-stack';
import { S3BucketsStack } from '../lib/s3/s3-buckets-stack';

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
new SandboxELBStack(mainStack, `sidekick-sandbox-elb-stack-${process.env.STAGE}`);

////////////////////////////////////////////////////////////////////////////////
//
// S3 Stack
//
new S3BucketsStack(mainStack, `sidekick-sandbox-s3-stack-${process.env.STAGE}`);
