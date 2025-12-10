---
trigger: always_on
---

1\. 🎯 **Project Purpose**
==========================

This project is a **personal finance management system** built with:

*   **Next.js 14+ (App Router)**
    
*   **TypeScript**
    
*   **TailwindCSS**
    
*   **shadcn/ui components**
    
*   **API Routes for backend**
    
*   **Prisma ORM**
    
*   **SQLite database**
    

The goal is to track:

*   Income (monthly)
    
*   Expenses (categorized)
    
*   Envelope percentages (financial categories)
    
*   Dashboard showing envelope usage vs limits
    
*   Optional: PDF import + AI classification in later phases
    

All code must follow the rules below.

2\. 🏗️ **Architecture Rules**
==============================

2.1 **Frontend + Backend in a single Next.js repository**
---------------------------------------------------------

*   Use **App Router** (/app directory).
    
*   API endpoints live inside:
    
    *   /app/api//route.ts
        

3\. 📚 **Code Style Rules**
===========================

*   Use TypeScript everywhere.
    
*   No any, unless absolutely necessary.
    
*   Use async/await, no .then() chains.
    
*   Follow consistent naming:
    
    *   getEnvelopes()
        
    *   createTransaction()
        
    *   calculateEnvelopeLimits()
        
    *   PascalCase for components
        
    *   camelCase for helpers
        
*   All files must be **default exports unless component**.
    

4\. 🚫 **Forbidden Practices**
==============================

The Coding Agent MUST NOT:

*   Create pages in /pages (App Router only).
    
*   Use styled-components or CSS modules.
    
*   Use inline style={{}}.
    
*   Mix server and client components incorrectly.
    
*   Write duplicate business logic.
    

5\. ✔️ **Mandatory Practices**
==============================

The Coding Agent MUST:

*   Write clean, typed, documented code.
    
*   Use Server Components where possible.
    
*   Use Client Components only for interactive UI.
    
*   Structure imports cleanly (no unused imports).
    
*   Keep routes RESTful and consistent.
    
*   Keep build passing without errors.