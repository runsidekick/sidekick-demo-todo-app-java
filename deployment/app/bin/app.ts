import { Stack } from 'aws-cdk-lib';

const result = require('dotenv').config({ path: `../${process.env.PROFILE}/.env` })
if (result.error) {
    throw result.error;
}

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SetupStack } from '../lib/setup-stack';
import { DeployStack } from '../lib/deploy-stack';

process.on('unhandledRejection', up => { throw up })

async function createApp() {
    const app = new cdk.App();
    const props = {
        env: {
            account: process.env.CDK_DEFAULT_ACCOUNT,
            region: process.env.CDK_DEFAULT_REGION
        },
    };

    // Create main stack
    const mainStack = new Stack(app, `sidekick-sandbox-todo-java-stack-${process.env.STAGE}`, props);

    // Create setup stack as nested stack
    const setupStack = new SetupStack(mainStack, `sidekick-sandbox-todo-java-setup-stack-${process.env.STAGE}`);
    await setupStack.create();

    // Create deploy stack as nested stack
    const deployStack = new DeployStack(mainStack, `sidekick-sandbox-todo-java-deploy-stack-${process.env.STAGE}`, setupStack);
    deployStack.addDependency(setupStack);
}

createApp();
