import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Peer, Port, SecurityGroup, SubnetType, Vpc} from "aws-cdk-lib/aws-ec2";
import {
    Cluster,
    Compatibility,
    ContainerImage,
    CpuArchitecture,
    FargateService,
    LogDriver,
    TaskDefinition
} from "aws-cdk-lib/aws-ecs";
import {
    ApplicationListener,
    ApplicationLoadBalancer,
    ApplicationProtocol,
    ApplicationTargetGroup
} from "aws-cdk-lib/aws-elasticloadbalancingv2";
import {ARecord, HostedZone, RecordTarget} from "aws-cdk-lib/aws-route53";
import {Certificate, CertificateValidation} from "aws-cdk-lib/aws-certificatemanager";
import {LoadBalancerTarget} from "aws-cdk-lib/aws-route53-targets";


export class SecureScalableNginxStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const domainName = "luediger.link";

        const vpc = new Vpc(this, "VPC", {
            vpcName: "SecureScalableNginxVPC",
        });

        const subnets = vpc.selectSubnets({
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        });

        const cluster = new Cluster(this, "EcsCluster", {
            vpc: vpc,
            clusterName: "SecureScalableNginxEcsCluster",
        });

        const taskDefinition = new TaskDefinition(this, "TaskDefinition", {
            compatibility: Compatibility.FARGATE,
            cpu: "256",
            memoryMiB: "512",
            runtimePlatform: {
                cpuArchitecture: CpuArchitecture.ARM64,
            }
        })

        taskDefinition.addContainer("NginxContainer", {
            image: ContainerImage.fromRegistry("nginx"),
            portMappings: [{containerPort: 80}],
            logging: LogDriver.awsLogs({
                streamPrefix: "nginx"
            })
        });

        const serviceSecurityGroup = new SecurityGroup(this, "ServiceSecurityGroup", {
            vpc: vpc,
            securityGroupName: "ServiceSecurityGroup",
            allowAllOutbound: true,
        })

        const service = new FargateService(this, "FargateService", {
            cluster: cluster,
            taskDefinition: taskDefinition,
            serviceName: "SecureScalableNginxService",
            vpcSubnets: subnets,
            desiredCount: 1,
            securityGroups: [serviceSecurityGroup]
        });


        const hostedZone = HostedZone.fromLookup(this, "HostedZone", {
            domainName: domainName,
        });

        const certificate = new Certificate(this, "Certificate", {
            domainName: domainName,
            validation: CertificateValidation.fromDns(hostedZone),
        });

        const loadBalancerSecurityGroup = new SecurityGroup(this, "SecurityGroup", {
            vpc: vpc,
            securityGroupName: "SecureScalableNginxSecurityGroup",
            allowAllOutbound: true,
        });

        serviceSecurityGroup.addIngressRule(loadBalancerSecurityGroup, Port.HTTP, "Allow HTTP traffic from the load balancer");

        const alb = new ApplicationLoadBalancer(this, "LoadBalancer", {
            vpc: vpc,
            securityGroup: loadBalancerSecurityGroup,
            internetFacing: true,
        });

        const listener = new ApplicationListener(this, "NginxListener", {
            loadBalancer: alb,
            port: 443,
            open: true,
            certificates: [certificate],
        });

        const targetGroup = new ApplicationTargetGroup(this, "NginxTargetGroup", {
            vpc: vpc,
            targetGroupName: "SecureScalableNginxTargetGroup",
            port: 80,
        });

        targetGroup.addTarget(service);

        listener.addTargetGroups("Nginx", {
            targetGroups: [targetGroup]
        });

        new ARecord(this, "ARecord", {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new LoadBalancerTarget(alb)),
        })
    }
}
