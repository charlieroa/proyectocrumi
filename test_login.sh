#!/bin/bash
curl -v -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@crumi.ai","password":"123456"}'
