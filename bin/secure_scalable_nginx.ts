#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SecureScalableNginxStack } from '../lib/secure_scalable_nginx_stack';

const app = new cdk.App();
new SecureScalableNginxStack(app, 'SecureScalableNginxStack', {
  env: { account: '241314003741', region: 'eu-central-1' },
});
