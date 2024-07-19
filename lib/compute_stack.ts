import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {
    Cluster,
    Compatibility,
    ContainerImage,
    CpuArchitecture,
    FargateService,
    LogDriver,
    TaskDefinition
} from "aws-cdk-lib/aws-ecs";
import {SecurityGroup, SubnetType, Vpc} from "aws-cdk-lib/aws-ec2";
import {Service} from "aws-cdk-lib/aws-servicediscovery";

export interface ComputeStackProps extends StackProps {
    domainName: string;
    vpc: Vpc;
}

export class ComputeStack extends Stack {
    public readonly service: FargateService;
    public readonly serviceSecurityGroup: SecurityGroup;

    constructor(scope: Construct, id: string, props: ComputeStackProps) {
        super(scope, id, props);

        const cluster = new Cluster(this, "EcsCluster", {
            vpc: props.vpc,
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

        this.serviceSecurityGroup = new SecurityGroup(this, "ServiceSecurityGroup", {
            vpc: props.vpc,
            securityGroupName: "ServiceSecurityGroup",
            allowAllOutbound: true,
        })

        const subnets = props.vpc.selectSubnets({
            subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        });

        this.service = new FargateService(this, "FargateService", {
            cluster: cluster,
            taskDefinition: taskDefinition,
            serviceName: "SecureScalableNginxService",
            vpcSubnets: subnets,
            desiredCount: 1,
            securityGroups: [this.serviceSecurityGroup]
        });
    }
}
