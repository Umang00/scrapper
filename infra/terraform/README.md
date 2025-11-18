# Universal Crawler - Terraform Infrastructure

This directory contains Terraform infrastructure as code for deploying the Universal Crawler system to AWS.

## Architecture

The infrastructure includes:
- **VPC**: Isolated network with public and private subnets
- **ECS Cluster**: Container orchestration for API server, workers, and frontend
- **RDS PostgreSQL**: Managed database for metadata storage
- **S3**: Artifact storage for screenshots, HAR files, and HTML
- **CloudWatch**: Monitoring and logging

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terraform** >= 1.6 installed
3. **AWS CLI** configured with credentials
4. **Docker images** built and pushed to container registry
5. **Supabase project** created and configured

## Quick Start

### 1. Configure Variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your actual values
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Review Plan

```bash
terraform plan
```

### 4. Apply Infrastructure

```bash
terraform apply
```

### 5. Get Outputs

```bash
terraform output
```

## Module Structure

The infrastructure is organized into modules:

- `modules/vpc`: VPC, subnets, NAT gateways, routing
- `modules/ecs`: ECS cluster, task definitions, services, load balancers
- `modules/rds`: PostgreSQL database instance
- `modules/s3`: S3 bucket with encryption and lifecycle policies
- `modules/monitoring`: CloudWatch log groups and alarms

## Important Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `aws_region` | AWS region | Yes |
| `environment` | Environment name (dev/staging/prod) | Yes |
| `db_password` | Database password | Yes |
| `supabase_url` | Supabase project URL | Yes |
| `supabase_service_role_key` | Supabase service key | Yes |
| `s3_bucket_name` | S3 bucket name | Yes |
| `encryption_key` | Encryption key for secrets | Yes |

## Security Considerations

1. **Never commit `terraform.tfvars`** - it contains secrets
2. Use **AWS Secrets Manager** for production secrets
3. Enable **MFA** for Terraform state bucket
4. Use **least privilege IAM policies**
5. Enable **VPC Flow Logs** for network monitoring
6. Configure **S3 bucket encryption** at rest

## Remote State

For production, configure remote state in S3:

```hcl
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "universal-crawler/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}
```

## Cost Estimation

Estimated monthly costs (us-east-1):
- ECS Fargate (API + Workers): $50-200
- RDS PostgreSQL (db.t3.medium): $60
- S3 Storage: $5-50 (depends on volume)
- CloudWatch Logs: $5-20
- **Total**: ~$120-330/month

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will delete all data. Ensure backups are in place.

## Modules Implementation Status

The main.tf file references modules that need to be created:
- [ ] `modules/vpc` - Network infrastructure
- [ ] `modules/ecs` - Container orchestration
- [ ] `modules/rds` - Database
- [ ] `modules/s3` - Storage
- [ ] `modules/monitoring` - Observability

These modules are placeholders and should be implemented based on your specific AWS architecture requirements.

## Next Steps

1. Implement individual Terraform modules
2. Configure CI/CD to run Terraform on infrastructure changes
3. Set up monitoring and alerting
4. Configure auto-scaling policies
5. Implement disaster recovery procedures
