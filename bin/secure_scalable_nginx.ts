#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {AuthenticationStack} from '../lib/secure_scalable_nginx_stack';
import {BaseStack} from "../lib/base_stack";
import {ComputeStack} from "../lib/compute_stack";

const app = new cdk.App();

const props = {
    env: {account: '241314003741', region: 'eu-central-1'},
    domainName: "luediger.link",
};

const baseStack = new BaseStack(app, 'BaseStack', props);

const computeStack = new ComputeStack(app, 'ComputeStack', {
    ...props,
    vpc: baseStack.vpc
});

new AuthenticationStack(app, 'AuthenticationStack', {
    ...props,
    vpc: baseStack.vpc,
    service: computeStack.service,
    serviceSecurityGroup: computeStack.serviceSecurityGroup
});
