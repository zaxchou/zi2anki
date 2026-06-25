# CLAUDE.md

## 部署安全硬规则

公开注册后，生产数据库是用户数据唯一真源。不得从本地数据库覆盖生产数据库。

当用户说“push 部署”或“部署”时，默认含义只能是：

1. 检查/构建当前代码
2. 推送 git（如用户要求）
3. 运行 `bash deploy.sh anki` 做安全代码部署
4. 做健康检查

严禁在普通部署中执行：

- `bash deploy.sh anki --sync`
- 本地 `pg_dump` 后恢复到生产
- 任何生产 `TRUNCATE`、批量删除用户数据、重置用户表的操作
- 未备份的内容发布或结构迁移

DB 相关操作必须遵守 [DEPLOYMENT_SAFETY.md](DEPLOYMENT_SAFETY.md)：先生产备份、验证备份、记录审计日志，再执行。

内容发布应走安全 upsert 机制；在内容 upsert 完成前，`deploy.sh anki --content` 应保持拒绝执行。