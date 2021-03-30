Minishops (server)
-----------------------------------

Tiny Ecommerce module for www.minipost.app

Minishops was created as a separate node.js application to run alongside the minipost app. This was done considering that minishops is meant to run all throughout the internet on clients business websites. This presents significant security risks which is why the module must be separate

The application allows users to:

Do CRUD operations for products on their shop\
Allow users to get data from sellers shops\
Provide embed data for shops embedded on foreign origin websites\
Process payments securely on the www.minipost.app domain using Stripe\
Send users to www.minipost.app to see more shop info if they are clicking from an embed\
See orders current and completed\
Filter allowed origins on a per-shop basis to display shop embed on seller's websites