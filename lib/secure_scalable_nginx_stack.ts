import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Port, SecurityGroup, Vpc} from "aws-cdk-lib/aws-ec2";
import {FargateService} from "aws-cdk-lib/aws-ecs";
import {
    ApplicationListener,
    ApplicationLoadBalancer,
    ApplicationTargetGroup,
    ListenerAction
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {LoadBalancerTarget} from "aws-cdk-lib/aws-route53-targets";
import {CfnUserPoolClient, OAuthScope, UserPool, UserPoolClient, UserPoolDomain} from "aws-cdk-lib/aws-cognito";
import {AuthenticateCognitoAction} from "aws-cdk-lib/aws-elasticloadbalancingv2-actions";

export interface AuthenticationStackProps extends StackProps {
    domainName: string;
    vpc: Vpc;
    service: FargateService;
    serviceSecurityGroup: SecurityGroup;
}

export class AuthenticationStack extends Stack {
    constructor(scope: Construct, id: string, props: AuthenticationStackProps) {
        super(scope, id, props);

        const hostedZone = HostedZone.fromLookup(this, "HostedZone", {
            domainName: props.domainName,
        });

        const certificate = new Certificate(this, "Certificate", {
            domainName: props.domainName,
            validation: CertificateValidation.fromDns(hostedZone),
        });

        const loadBalancerSecurityGroup = new SecurityGroup(this, "SecurityGroup", {
            vpc: props.vpc,
            securityGroupName: "SecureScalableNginxSecurityGroup",
            allowAllOutbound: true,
        });

        props.serviceSecurityGroup.addIngressRule(loadBalancerSecurityGroup, Port.HTTP, "Allow HTTP traffic from the load balancer");

        const alb = new ApplicationLoadBalancer(this, "LoadBalancer", {
            vpc: props.vpc,
            securityGroup: loadBalancerSecurityGroup,
            internetFacing: true,
        });

        const userPool = new UserPool(this, "UserPool", {
            userPoolName: "SecureScalableNginxUserPool",
            selfSignUpEnabled: true,
        });

        const userPoolClient = new UserPoolClient(this, "UserPoolClient", {
            userPool: userPool,
            generateSecret: true,
            authFlows: {
                userPassword: true,
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [OAuthScope.EMAIL],
                callbackUrls: [`https://${props.domainName}/oauth2/idpresponse`],
            },
        });

        const cfnClient = userPoolClient.node.defaultChild as CfnUserPoolClient;
        cfnClient.addPropertyOverride('RefreshTokenValidity', 1);
        cfnClient.addPropertyOverride('SupportedIdentityProviders', ['COGNITO']);

        const userPoolDomain = new UserPoolDomain(this, "UserPoolDomain", {
            userPool: userPool,
            cognitoDomain: {
                domainPrefix: "secure-scalable-nginx"
            }
        });

        const targetGroup = new ApplicationTargetGroup(this, "NginxTargetGroup", {
            vpc: props.vpc,
            targetGroupName: "SecureScalableNginxTargetGroup",
            port: 80,
        });

        targetGroup.addTarget(props.service);

        new ApplicationListener(this, "NginxListener", {
            loadBalancer: alb,
            port: 443,
            open: true,
            certificates: [certificate],
            defaultAction: new AuthenticateCognitoAction({
                next: ListenerAction.forward([targetGroup]),
                userPool: userPool,
                userPoolClient: userPoolClient,
                userPoolDomain: userPoolDomain,
            }),
        });

        new ARecord(this, "ARecord", {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
        });
    }
}
