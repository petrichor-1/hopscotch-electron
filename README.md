# How to use:
1. Clone the repository
     ```
    git clone https://github.com/petrichor-1/hopscotch-electron.git
    cd hopscotch-electron
    ```
2. Install dependencies
   ```
   npm install
   ```
3. Generate your electron project. A hopscotch project's uuid is the last part of the link, ie `13pyjx5u37` in `https://c.gethopscotch.com/p/13pyjx5u37`
   ```
   ./generate.js <project-uuid> <result-directory>
   ```
4. `cd` into the path you privded for `result-directory`
5. `npm install`
6. You can start the project with `npm run start` or follow the directions at https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging to package the project


# TODO
Future improvements to this project are:
* Do not download custom images that aren't actually used
* Show loading screen