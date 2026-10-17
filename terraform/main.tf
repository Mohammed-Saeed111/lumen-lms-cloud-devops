module "vpc" {
  source = "./modules/vpc"

  vpc_cidr             = var.vpc_cidr
  vpc_name             = "nti-devops-vpc"
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}
