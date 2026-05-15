output "postiz_public_ip" {
  description = "Add this as an A record:  postiz.sienovo.cn  ->  <this IP>  at your DNS provider"
  value       = aws_eip.postiz.public_ip
}

output "postiz_dns_instructions" {
  value = "DNS:  postiz.sienovo.cn  A  ${aws_eip.postiz.public_ip}    (TTL 300)"
}

output "ssm_session_command" {
  description = "Open an interactive shell on the Postiz host without SSH"
  value       = "aws ssm start-session --target ${aws_instance.postiz.id} --region ${var.aws_region}"
}
