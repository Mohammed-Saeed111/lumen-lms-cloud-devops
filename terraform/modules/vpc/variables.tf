variable "vpc_cidr" {
  description = "CIDR range for the VPC"
  type        = string
}

variable "vpc_name" {
  description = "Name of the existing VPC"
  type        = string
}

variable "availability_zones" {
  description = "Availability Zones for the subnets"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR ranges for public subnets"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR ranges for private subnets"
  type        = list(string)
}
