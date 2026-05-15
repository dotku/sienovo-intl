variable "aws_region" {
  description = "Region for all infra. State bucket is fixed in us-east-1 (see main.tf backend)."
  type        = string
  default     = "us-east-1"
}

variable "postiz_instance_type" {
  description = "EC2 size for Postiz. t3.medium = 4GB RAM, the minimum for the full Postiz+Temporal+ES stack."
  type        = string
  default     = "t3.medium"
}

variable "postiz_disk_gb" {
  description = "Root EBS volume size."
  type        = number
  default     = 30
}

variable "ssh_pubkey" {
  description = "Your local SSH public key (cat ~/.ssh/id_ed25519.pub). Imported as an EC2 KeyPair so you can SSH in. Leave blank to skip SSH (use SSM instead)."
  type        = string
  default     = ""
}

variable "allowed_ssh_cidr" {
  description = "Source IP CIDR allowed to SSH. Default closes SSH off the public internet — use SSM Session Manager instead, or override with your home IP."
  type        = string
  default     = "127.0.0.1/32"
}
