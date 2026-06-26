Hello. We have to work on the Pickleball project. Your task is to guide the AI agent by providing prompts that I will send to the agent. I will then share the AI agent's responses with you, and you will review them and help complete the work using the best coding, architecture, maintainability, scalability, and engineering practices.

The goal is to identify all pages in the web application, excluding everything under `web/src/app/(staff)/`. This analysis should also include all related components, hooks, services, utilities, stores, and any other files associated with those pages.

Next, we need to determine which APIs are required for each page and verify whether those APIs already exist and are implemented.

After that, categorize the pages as follows:

* Pages that require APIs which have not yet been developed. These pages should be excluded from the scope and count for now.
* Pages whose required APIs already exist and are implemented.

For the pages with existing APIs, determine whether they are:

* Fully connected
* Partially connected
* Not connected

Pages that are fully connected and implemented according to best practices should also be excluded from the scope and count.

Our focus should then be on:

* Pages that are partially connected and need to be fully integrated.
* Pages that are not connected but already have the required APIs available.

We will ensure that all pages within this scope are fully connected using best-in-class engineering practices.

Additionally, verify that none of these pages contain mock data, temporary implementations, hardcoded values, placeholder logic, fake API responses, duplicate implementations, or similar shortcuts. The final result should be a clean, maintainable, scalable, and non-duplicative implementation.

Please provide the first prompt that should be sent to the AI agent.
