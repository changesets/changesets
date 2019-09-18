import React, { useState } from "react";
import { Link } from "gatsby";
import { Spacer } from "gatsby-theme-sidebar";
import { MDXProvider } from "@mdx-js/react";
import Highlight, { defaultProps } from "prism-react-renderer";
import colors from "../colors";
import { theme as codeTheme } from "../code-theme";

const NavLink = props => (
  <Link
    activeClassName="active"
    css={{
      display: "block",
      color: "inherit",
      textDecoration: "none",
      fontWeight: "bold",
      paddingLeft: 32,
      paddingRight: 32,
      paddingTop: 8,
      paddingBottom: 8,
      marginLeft: -32,
      marginRight: -32,
      "&.active": {
        color: colors.active
      }
    }}
    {...props}
  />
);

const MenuButton = props => (
  <button
    {...props}
    css={{
      appearance: "none",
      fontFamily: "inherit",
      fontSize: "inherit",
      padding: 8,
      color: "inherit",
      backgroundColor: "transparent",
      border: "none",
      "&:focus": {
        color: colors.blue,
        outline: `1px solid ${colors.blue}`
      }
    }}
  />
);

const Title = props => (
  <h1
    {...props}
    css={{
      margin: 0,
      fontSize: 16
    }}
  />
);

const hamburger = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
  </svg>
);

let components = {
  a: ({ href, ...props }) => {
    if (href.startsWith("http")) {
      return <a href={href} {...props} />;
    }
    return <Link to={href} {...props} />;
  },
  blockquote: props => {
    return (
      <blockquote
        css={{
          borderLeft: `8px solid ${colors.base}`,
          paddingLeft: 16,
          marginLeft: 0,
          backgroundColor: colors.pink,
          paddingTop: 16,
          paddingBottom: 16
        }}
        {...props}
      />
    );
  },
  pre: ({ children: { props } }) => {
    const lang = props.className && props.className.split("-")[1];
    return (
      <div
        css={{
          width: "100% !important",
          marginBottom: "1.5rem",
          overflowX: "auto",
          "& pre": {
            overflowX: "auto",
            width: "100%",
            padding: 16
          }
        }}
      >
        <Highlight
          {...defaultProps}
          theme={codeTheme}
          code={props.children.trim()}
          language={lang}
        >
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre className={className} css={{ marginBottom: 0 }} style={style}>
              {tokens.map((line, i) => (
                <div {...getLineProps({ line, key: i })}>
                  {line.map((token, key) => (
                    <span {...getTokenProps({ token, key })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    );
  }
};

export default ({
  Layout,
  Header,
  Main,
  Sidebar,
  Content,
  MobileOnly,
  // breakpoint,
  ...props
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  let isIndexPage = props.location.pathname === "/";
  return (
    <Layout
      css={{
        color: colors.black
      }}
    >
      <Header
        css={{
          color: "white",
          backgroundColor: colors.base
        }}
      >
        <NavLink
          activeClassName=""
          css={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center"
          }}
          to="/"
        >
          <div
            css={{
              fontSize: 24,
              marginRight: 8
            }}
          >
            🎁
          </div>
          <Title>preconstruct</Title>
        </NavLink>
        <Spacer />
        <div
          css={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <NavLink activeClassName="" to="/getting-started">
            Docs
          </NavLink>
          {!isIndexPage && (
            <MobileOnly>
              <MenuButton
                css={{ display: "inline-flex" }}
                title="toggleMenu"
                onClick={() => {
                  setSidebarOpen(!sidebarOpen);
                }}
              >
                {hamburger}
              </MenuButton>
            </MobileOnly>
          )}
        </div>
      </Header>
      <Main>
        {!isIndexPage && (
          <Sidebar
            width={320}
            open={sidebarOpen}
            onClick={() => {
              setSidebarOpen(false);
            }}
            onDismiss={() => {
              setSidebarOpen(false);
            }}
            css={{
              paddingTop: 32,
              paddingBottom: 32,
              backgroundColor: colors.pink
            }}
          >
            <NavLink to="/getting-started">Getting Started</NavLink>
            <NavLink to="/dictionary">Dictionary</NavLink>
            <NavLink to="/tutorials">Building your first package</NavLink>
            <div css={{ marginLeft: 16 }}>
              <NavLink to="/tutorials/multi-package-repo">
                Building a Multi-package Repo
              </NavLink>
              <NavLink to="/tutorials/multiple-entrypoints">
                Exporting Multiple Entrypoints
              </NavLink>
            </div>
            <NavLink to="/guides">Guides</NavLink>
            <div css={{ marginLeft: 16 }}>
              <NavLink to="/guides/configuring-babel">
                Configuring Babel
              </NavLink>
              <NavLink to="/guides/using-preconstruct-dev-in-a-multi-package-repo">
                Using preconstruct dev in a multi-package repo
              </NavLink>
              <NavLink to="/guides/when-should-i-use-multiple-entrypoints">
                When should I use multiple entrypoints?
              </NavLink>
              <NavLink to="/guides/building-typescript-packages">
                Building TypeScript packages
              </NavLink>
            </div>
            <NavLink to="/commands">Commands</NavLink>
            <div css={{ marginLeft: 16 }}>
              <NavLink to="/commands/init">init</NavLink>
              <NavLink to="/commands/build">build</NavLink>
              <NavLink to="/commands/dev">dev</NavLink>
              <NavLink to="/commands/fix">fix</NavLink>
              <NavLink to="/commands/validate">validate</NavLink>
              <NavLink to="/commands/watch">watch</NavLink>
            </div>
            <NavLink to="/config">Configuration</NavLink>
            <div css={{ marginLeft: 16 }}>
              <NavLink to="/config/projects">Projects</NavLink>
              <NavLink to="/config/packages">Packages</NavLink>
              <NavLink to="/config/entrypoints">Entrypoints</NavLink>
            </div>
            <NavLink to="/errors">Errors</NavLink>
            <div css={{ marginLeft: 16 }}>
              {/* <NavLink to="/errors/something">Monorepos</NavLink> */}
            </div>

            <NavLink to="/decisions">Architecture and Design Decisions</NavLink>
          </Sidebar>
        )}

        <Content
          css={{
            paddingTop: 32,
            paddingBottom: 32,
            ...(!isIndexPage && {
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }),
            "h1 code, h2 code, h3 code, h4 code, h5 code, h6 code": {
              fontSize: "inherit"
            },
            details: {
              borderLeft: `8px solid ${colors.base}`,
              backgroundColor: colors.pink,
              padding: 16,
              marginBottom: 16
            },
            "details[open] summary": {
              marginBottom: 16
            }
          }}
        >
          <MDXProvider components={components}>{props.children}</MDXProvider>
        </Content>
      </Main>
    </Layout>
  );
};
