---
applyTo: "**"             
description: Global repo standards
---

MOST IMPORTANT INSTURCITONS TO FOLLOW:
Think cerfully and only action the specific task I have given to you with most consise and elegant solution that changes as little code as possible.

Dont create util functions in the api routes, just inline the code.

Never use type "any", its not allowed in this project.
Never run cli command 'npm run dev'. 
Don't create new files or helpers in the `src/lib` directory. Write all business logic directly in the files where it is needed. 
New types: write common types in `src/types/types.ts` and colocated types in the API route files.
Dont create scripts files for testing.
Always use ?? insetead of ||.

Make sure that we dont create new util functions, we should inlice code where is used.

A new API route has been created or modified. Please review the code to ensure it implements proper security measures:

1. **Authentication Check**: Verify the route properly authenticates users (using Clerk auth() or similar)
2. **User Data Isolation**: Ensure users can only access their own data - check for proper user ID filtering in database queries
3. **Project Context**: If applicable, verify project-based data isolation is implemented
4. **Authorization**: Check that users have proper permissions for the requested operations
5. **Input Validation**: Ensure request data is properly validated and sanitized
6. **Error Handling**: Verify sensitive information is not leaked in error responses

Focus on identifying any potential security vulnerabilities where users might be able to access data belonging to other users. Provide specific recommendations for fixing any security issues found.