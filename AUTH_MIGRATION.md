# Authentication Migration Guide

## Overview
This guide explains how to replace Supabase authentication with a simpler MongoDB-based auth framework while keeping MongoDB for data storage.

## Current Setup
- **Authentication**: NextAuth.js with MongoDB adapter
- **Data Storage**: MongoDB (via Mongoose)
- **Legacy Auth**: Supabase (being phased out)

## Solution Implemented

### 1. Test User Creation
A test user has been created for development purposes:

**Email**: `romain-client@gmail.com`
**Password**: `password123`

To initialize the test user, run:
```bash
cd apps/web
npm run create-test-user
```

### 2. Authentication Flow
The system now supports two authentication modes:

#### Development Mode (Test Users)
- Uses in-memory test users for quick development
- No database writes required
- Perfect for testing UI and auth flows

#### Production Mode (MongoDB)
- Uses NextAuth's MongoDB adapter
- Stores users in the `users` collection
- Requires proper MongoDB permissions

### 3. Key Files Created/Modified

**New Files:**
- `apps/web/lib/auth.ts` - Core auth utilities (hashing, verification)
- `apps/web/lib/validateUserCredentials.ts` - MongoDB credential validation
- `apps/web/scripts/create-test-user.ts` - Initialize test user
- `apps/web/scripts/test-auth.ts` - Test authentication

**Modified Files:**
- `apps/web/app/api/auth/[...nextauth]/route.ts` - Updated to support both dev and prod auth

## How It Works

### Authentication Priority
1. **First**: Check in-memory test users (development only)
2. **Then**: Validate against MongoDB (production)
3. **Finally**: Return null if no match found

### Password Hashing
- Uses bcrypt when available (recommended for production)
- Falls back to simple XOR hash for development/testing
- Secure enough for testing purposes

## Testing the Setup

### Initialize Test User
```bash
cd apps/web
npm run create-test-user
```

### Run Authentication Tests
```bash
cd apps/web
npm run test-auth
```

### Expected Output
```
✓ Test user initialized in memory
✓ Found test user: romain-client@gmail.com
✓ Correct password verification: PASS
✓ Wrong password verification: PASS

✓ Authentication test passed!
```

## Migration Path

### Phase 1: Development (Current State)
- Use in-memory test users for development
- Test authentication flows without database dependencies
- Verify UI components work correctly

### Phase 2: Production Readiness
- Set up proper MongoDB user with write permissions to `users` collection
- Create real users through NextAuth registration endpoints
- Migrate any existing Supabase users to MongoDB

### Phase 3: Full Migration
- Remove all Supabase dependencies
- Update all auth-related code to use NextAuth directly
- Clean up legacy Supabase integration files

## Environment Variables

Required for production:
```bash
MONGODB_URI=mongodb+srv://your-cluster.mongodb.net/
MONGODB_DB=kletron
NEXTAUTH_SECRET=your-secret-key-here
```

For development (test users only):
```bash
# No MongoDB write permissions needed for test users
# Test users work with read-only database access
```

## Troubleshooting

### "User is not allowed to do action [insert] on [kletron.users]"
This error occurs when the MongoDB user doesn't have write permissions. For development, you can use the test user system which doesn't require write access.

### Authentication Test Fails
Make sure you've run `npm run create-test-user` before running tests. The test user is initialized in memory and persists for the duration of the Node.js process.

## Benefits of This Approach

1. **Simplicity**: No complex Supabase setup required
2. **Flexibility**: Works with or without MongoDB write access
3. **Development-Friendly**: Quick testing without database dependencies
4. **Production-Ready**: Easy transition to real MongoDB authentication
5. **MongoDB-Centric**: Keeps all data in one place (MongoDB)

## Next Steps

1. ✅ Test user created and working
2. ✅ Authentication flow implemented
3. ⏳ Set up MongoDB write permissions for production users
4. ⏳ Create user registration endpoints
5. ⏳ Migrate existing Supabase users to MongoDB