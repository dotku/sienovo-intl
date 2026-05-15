data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]
  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }
}

data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "postiz" {
  name        = "postiz"
  description = "Postiz: HTTP/HTTPS public, SSH restricted"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Caddy ACME challenge + redirect"
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Caddy HTTPS"
  }
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
    description = "SSH (restricted; use SSM if blank)"
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_iam_role" "postiz_ec2" {
  name = "postiz-ec2"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "postiz_ssm" {
  role       = aws_iam_role.postiz_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "postiz" {
  name = "postiz-ec2"
  role = aws_iam_role.postiz_ec2.name
}

resource "aws_key_pair" "postiz" {
  count      = var.ssh_pubkey == "" ? 0 : 1
  key_name   = "postiz"
  public_key = var.ssh_pubkey
}

resource "aws_instance" "postiz" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.postiz_instance_type
  vpc_security_group_ids = [aws_security_group.postiz.id]
  iam_instance_profile   = aws_iam_instance_profile.postiz.name
  key_name               = var.ssh_pubkey == "" ? null : aws_key_pair.postiz[0].key_name

  root_block_device {
    volume_size = var.postiz_disk_gb
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    apt-get update
    apt-get install -y git curl
    cd /opt
    git clone https://github.com/dotku/sienovo-intl.git
    cd sienovo-intl/deploy/postiz
    chmod +x install.sh
    sudo -u ubuntu bash install.sh 2>&1 | tee /var/log/postiz-install.log
  EOT

  tags = { Name = "postiz" }

  lifecycle {
    # user-data only runs on first boot; allow it to change without forcing replace
    ignore_changes = [user_data, ami]
  }
}

resource "aws_eip" "postiz" {
  instance = aws_instance.postiz.id
  domain   = "vpc"
  tags     = { Name = "postiz" }
}
