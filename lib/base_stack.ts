import {Stack, StackProps} from "aws-cdk-lib";
import {Construct} from "constructs";
import {Vpc} from "aws-cdk-lib/aws-ec2";

export class BaseStack extends Stack {
    public readonly vpc: Vpc;
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        this.vpc = new Vpc(this, "VPC", {
            vpcName: "SecureScalableNginxVPC",
        });
    }
}
