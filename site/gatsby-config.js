module.exports = {
  plugins: [
    "gatsby-theme-sidebar",
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `pages`,
        path: `${__dirname}/src/pages/`
      }
    },
    {
      resolve: "gatsby-plugin-page-creator",
      options: {
        path: `${__dirname}/src/pages/`
      }
    },
    "gatsby-plugin-mdx",
    {
      resolve: "gatsby-plugin-typography",
      options: {
        pathToConfigModule: "src/typography"
      }
    },
    "gatsby-plugin-emotion",
    {
      resolve: "gatsby-plugin-google-analytics",
      options: {
        trackingId: "UA-140394521-1"
      }
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: "Preconstruct",
        short_name: "Preconstruct",
        start_url: "/",
        background_color: "#ea2929",
        theme_color: "#ea2929",
        display: "browser",
        icon: "src/images/icon.png"
      }
    }
  ]
};
