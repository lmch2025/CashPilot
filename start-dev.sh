#!/bin/bash
export DATABASE_URL="postgresql://neondb_owner:npg_NOmDjTk48tEy@ep-fragrant-boat-adi8y5ui-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
export DIRECT_URL="postgresql://neondb_owner:npg_NOmDjTk48tEy@ep-fragrant-boat-adi8y5ui.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
exec node node_modules/next/dist/bin/next dev -p 3000
