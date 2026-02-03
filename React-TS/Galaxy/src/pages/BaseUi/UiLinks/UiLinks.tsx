import PrismCode from "../../../Components/Common/Prism";

// Default List

const linkColorsCode =
    `
    <p><NavLink href="#" className="link-primary">Primary link</NavLink></p>
    <p><NavLink href="#" className="link-secondary">Secondary link</NavLink></p>
    <p><NavLink href="#" className="link-success">Success link</NavLink></p>
    <p><NavLink href="#" className="link-danger">Danger link</NavLink></p>
    <p><NavLink href="#" className="link-warning">Warning link</NavLink></p>
    <p><NavLink href="#" className="link-info">Info link</NavLink></p>
    <p><NavLink href="#" className="link-light">Light link</NavLink></p>
    <p><NavLink href="#" className="text-body">Dark link</NavLink></p>
    <p><NavLink href="#" className="link-body-emphasis mb-0">Emphasis link</NavLink></p>
`;

const LinkColorsExample = () => (
    <PrismCode
        code={linkColorsCode}
        language={("html")}
        plugins={["line-numbers"]}
    />
);

// Link utilities
const linkUtilitiesCode =
    `
    <p><NavLink href="#" className="link-primary link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Primary link</NavLink></p>
    <p><NavLink href="#" className="link-secondary link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Secondary link</NavLink></p>
    <p><NavLink href="#" className="link-success link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Success link</NavLink></p>
    <p><NavLink href="#" className="link-danger link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Danger link</NavLink></p>
    <p><NavLink href="#" className="link-warning link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Warning link</NavLink></p>
    <p><NavLink href="#" className="link-info link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Info link</NavLink></p>
    <p><NavLink href="#" className="link-light link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Light link</NavLink></p>
    <p><NavLink href="#" className="text-body link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Dark link</NavLink></p>
    <p><NavLink href="#" className="link-body-emphasis link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-75-hover mb-0">Emphasis link</NavLink></p>
`;

const LinkUtilitiesExample = () => (
    <PrismCode
        code={linkUtilitiesCode}
        language={("html")}
        plugins={["line-numbers"]}
    />
);

// Disabled Items
const linkOpacityCode =
    `
<!-- Disabled Items -->
<p><NavLink className="link-opacity-10" href="#">Link opacity 10</NavLink></p>
<p><NavLink className="link-opacity-25" href="#">Link opacity 25</NavLink></p>
<p><NavLink className="link-opacity-50" href="#">Link opacity 50</NavLink></p>
<p><NavLink className="link-opacity-75" href="#">Link opacity 75</NavLink></p>
<p className="mb-0"><a className="link-opacity-100" href="#">Link opacity 100</a></p>
`;

//Link Opacity
const LinkOpacityExample = () => (
    <PrismCode
        code={linkOpacityCode}
        language={("html")}
        plugins={["line-numbers"]}
    />
);

// List with Link
const listlinkCode =
    `
    <p><NavLink className="link-opacity-10-hover" href="#">Link hover opacity 10</NavLink></p>
    <p><NavLink className="link-opacity-25-hover" href="#">Link hover opacity 25</NavLink></p>
    <p><NavLink className="link-opacity-50-hover" href="#">Link hover opacity 50</NavLink></p>
    <p><NavLink className="link-opacity-75-hover" href="#">Link hover opacity 75</NavLink></p>
    <p className="mb-0"><NavLink className="link-opacity-100-hover" href="#">Link hover opacity 100</NavLink></p>
`;

const LinkOpacityHover = () => (
    <PrismCode
        code={listlinkCode}
        language={("html")}
        plugins={["line-numbers"]}
    />
);

// Underline Color
const underlineColorCode =
    `
    <p><NavLink href="#" className="text-decoration-underline link-underline-primary">Primary underline</NavLink></p>
    <p><NavLink href="#" className="text-decoration-underline link-underline-secondary">Secondary underline</NavLink></p>
    <p><NavLink href="#" className="text-decoration-underline link-underline-success">Success underline</NavLink></p>
    <p><NavLink href="#" className="text-decoration-underline link-underline-danger">Danger underline</NavLink></p>
    <p><NavLink href="#" className="text-decoration-underline link-underline-warning">Warning underline</NavLink></p>
    <p><NavLink href="#" className="text-decoration-underline link-underline-info">Info underline</NavLink></p>
    <p><NavLink href="#" className="text-decoration-underline link-underline-light">Light underline</NavLink></p>
    <p className="mb-0"><NavLink href="#" className="text-decoration-underline link-underline-dark">Dark underline</NavLink></p>
`;

const UnderlineColor = () => (
    <PrismCode
        code={underlineColorCode}
        language={("html")}
        plugins={["line-numbers"]}
    />
);

// Underline Opacity
const underlineOpacity =
    `
    <p><NavLink className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-0" href="#">Underline opacity 0</NavLink></p>
    <p><NavLink className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-10" href="#">Underline opacity 10</NavLink></p>
    <p><NavLink className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-25" href="#">Underline opacity 25</NavLink></p>
    <p><NavLink className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-50" href="#">Underline opacity 50</NavLink></p>
    <p><NavLink className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-75" href="#">Underline opacity 75</NavLink></p>
    <p className="mb-0"><NavLink className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-100" href="#">Underline opacity 100</NavLink></p>
`;

const UnderlineOpacity = () => (
    <PrismCode
        code={underlineOpacity}
        language={("html")}
        plugins={["line-numbers"]}
    />
);

// Underline offset
const underlineOffset =
    `
    <p><NavLink href="#">Default link</NavLink></p>
    <p><NavLink className="text-decoration-underline link-offset-1" href="#">Offset 1 link</NavLink></p>
    <p><NavLink className="text-decoration-underline link-offset-2" href="#">Offset 2 link</NavLink></p>
    <p className="mb-0"><NavLink className="text-decoration-underline link-offset-3" href="#">Offset 3 link</NavLink></p>
`;

const UnderlineOffset = () => (
    <PrismCode
        code={underlineOffset}
        language={("html")}
        plugins={["line-numbers"]}
    />
);

export { LinkColorsExample, LinkOpacityExample, LinkOpacityHover, UnderlineColor, UnderlineOpacity, UnderlineOffset, LinkUtilitiesExample };