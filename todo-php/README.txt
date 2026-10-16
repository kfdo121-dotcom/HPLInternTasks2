Taskboard: To-Do app (PHP + MySQL)

1. Start XAMPP

Open the XAMPP Control Panel (run it as administrator on Windows).
Click Start next to Apache and MySQL. Both should turn green.

2. Put the project in htdocs

Unzip todo-php.zip.
Copy the todo-php folder to C:\xampp\htdocs\, so you end up with C:\xampp\htdocs\todo-php\api.php.

3. Create the database

Open http://localhost/phpmyadmin in your browser.
Click the Import tab, choose database.sql from the folder, and click Import. You should see a taskboard database with a tasks table.

Files
  index.html   page markup
  style.css    styles
  script.js    front end, talks to api.php with fetch()
  api.php      JSON API: GET list, POST create, PUT ?id= update,
               DELETE ?id= delete, DELETE ?completed=1 clear done
  config.php   database settings
  database.sql schema
