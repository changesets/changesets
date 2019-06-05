Use [enquirer](https://github.com/enquirer/enquirer) instead of inquirer for asking questions because it's smaller, faster and prettier.
Change bump type questions from asking for each bump type individually per package to asking users to two questions where the user selects what packages should have major and minor bumps and the packages left are assumed to be patch bumps. This dramatically cuts down the amount of time it takes to create a changeset with a large number of packages.

![example of using the CLI with the new questions](https://user-images.githubusercontent.com/11481355/58873398-a1c4de80-8709-11e9-80e8-16061e395b15.gif)
