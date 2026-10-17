provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "Lumen-LMS"
      ManagedBy = "Terraform"
      Lab       = "Lab-01"
    }
  }
}
