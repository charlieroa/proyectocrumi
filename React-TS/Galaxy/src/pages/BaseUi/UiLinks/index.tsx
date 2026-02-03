import React from 'react';
import { Card, CardBody, Col, Container, Row, NavLink } from 'reactstrap';

import PreviewCardHeader from '../../../Components/Common/PreviewCardHeader';
// Import Content
import UiContent from '../../../Components/Common/UiContent';
//import Components
import BreadCrumb from '../../../Components/Common/BreadCrumb';

import { LinkColorsExample, LinkOpacityExample, LinkOpacityHover, UnderlineColor, UnderlineOpacity, UnderlineOffset, LinkUtilitiesExample } from './UiLinks';
import { Link } from 'react-router-dom';

const UiLink = () => {
    document.title = "Colored Links | Velzon - React Admin & Dashboard Template";
    return (
        <React.Fragment>
            <UiContent />
            <div className="page-content">
                <Container fluid>
                    <BreadCrumb title="Colored Links" pageTitle="Base UI" />
                    <Row>
                        <Col lg={6}>
                            <Card>
                                <PreviewCardHeader title="Link colors" />

                                <CardBody>
                                    <p className="text-muted">You can use the <code>.link-*</code> classes to colorize links. Unlike the <a href="ui-colors.html"><code>.text-*</code> classes</a>, these classes have a <code>:hover</code> and <code>:focus</code> state. Some of the link styles use a relatively light foreground color, and should only be used on a dark background in order to have sufficient contrast.</p>
                                    <div className="live-preview">
                                        <p><NavLink href="/#" className="link-primary">Primary link</NavLink></p>
                                        <p><NavLink href="/#" className="link-secondary">Secondary link</NavLink></p>
                                        <p><NavLink href="/#" className="link-success">Success link</NavLink></p>
                                        <p><NavLink href="/#" className="link-danger">Danger link</NavLink></p>
                                        <p><NavLink href="/#" className="link-warning">Warning link</NavLink></p>
                                        <p><NavLink href="/#" className="link-info">Info link</NavLink></p>
                                        <p><NavLink href="/#" className="link-light">Light link</NavLink></p>
                                        <p><NavLink href="/#" className="text-body">Dark link</NavLink></p>
                                        <p><NavLink href="/#" className="link-body-emphasis mb-0">Emphasis link</NavLink></p>
                                    </div>

                                    <div className="d-none code-view">
                                        <pre className="language-markup">
                                            <code>
                                                <LinkColorsExample />
                                            </code>
                                        </pre>
                                    </div>

                                </CardBody>
                            </Card>
                        </Col>


                        <Col lg={6}>
                            <Card>
                                <PreviewCardHeader title="Link utilities" />

                                <CardBody>
                                    <p className="text-muted">Colored links can also be modified by our link utilities.</p>
                                    <div className="live-preview">
                                        <p><NavLink href="/#" className="link-primary link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Primary link</NavLink></p>
                                        <p><NavLink href="/#" className="link-secondary link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Secondary link</NavLink></p>
                                        <p><NavLink href="/#" className="link-success link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Success link</NavLink></p>
                                        <p><NavLink href="/#" className="link-danger link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Danger link</NavLink></p>
                                        <p><NavLink href="/#" className="link-warning link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Warning link</NavLink></p>
                                        <p><NavLink href="/#" className="link-info link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Info link</NavLink></p>
                                        <p><NavLink href="/#" className="link-light link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Light link</NavLink></p>
                                        <p><NavLink href="/#" className="text-body link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-100-hover">Dark link</NavLink></p>
                                        <p><NavLink href="/#" className="link-body-emphasis link-offset-2 text-decoration-underline link-underline-opacity-25 link-underline-opacity-75-hover mb-0">Emphasis link</NavLink></p>
                                    </div>

                                    <div className="d-none code-view">
                                        <pre className="language-markup">
                                            <code>
                                                <LinkUtilitiesExample />
                                            </code>
                                        </pre>
                                    </div>

                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                    <Row>

                        <Col lg={6}>
                            <Card>
                                <PreviewCardHeader title="Link Opacity" />

                                <CardBody>
                                    <p className="text-muted">Change the alpha opacity of the link <code>rgba()</code> color value with utilities. Please be aware that changes to a color’s opacity can lead to links with <Link to="https://getbootstrap.com/docs/5.3/getting-started/accessibility/#color-contrast" target="_blank"><em>insufficient</em> contrast</Link>.</p>
                                    <div className="live-preview">
                                        <p><Link className="link-opacity-10" to="#">Link opacity 10</Link></p>
                                        <p><Link className="link-opacity-25" to="#">Link opacity 25</Link></p>
                                        <p><Link className="link-opacity-50" to="#">Link opacity 50</Link></p>
                                        <p><Link className="link-opacity-75" to="#">Link opacity 75</Link></p>
                                        <p className="mb-0"><Link className="link-opacity-100" to="#">Link opacity 100</Link></p>
                                    </div>

                                    <div className="d-none code-view">
                                        <pre className="language-markup" style={{ height: "215px" }}>
                                            <code>
                                                <LinkOpacityExample />
                                            </code>
                                        </pre>
                                    </div>
                                </CardBody>
                            </Card>
                        </Col>


                        <Col lg={6}>
                            <Card>
                                <PreviewCardHeader title="Link Opacity Hover" />

                                <CardBody>
                                    <p className="text-muted">Use <code>tag="NavLink"</code> to create actionable list group items with hover, disabled, and active states by adding list-group-item-action.</p>
                                    <div className="live-preview">
                                        <p><Link className="link-opacity-10-hover" to="/#">Link hover opacity 10</Link></p>
                                        <p><Link className="link-opacity-25-hover" to="/#">Link hover opacity 25</Link></p>
                                        <p><Link className="link-opacity-50-hover" to="/#">Link hover opacity 50</Link></p>
                                        <p><Link className="link-opacity-75-hover" to="/#">Link hover opacity 75</Link></p>
                                        <p className="mb-0"><Link className="link-opacity-100-hover" to="/#">Link hover opacity 100</Link></p>
                                    </div>


                                    <div className="d-none code-view">
                                        <pre className="language-markup">
                                            <code>
                                                <LinkOpacityHover />
                                            </code>
                                        </pre>
                                    </div>

                                </CardBody>
                            </Card>
                        </Col>
                    </Row>

                    <Row>
                        <Col xxl={4}>
                            <Card>
                                <PreviewCardHeader title="Underline color" />

                                <CardBody>
                                    <p className="text-muted">Change the underline’s color independent of the link text color.</p>
                                    <div className="live-preview">
                                        <p><Link to="#" className="text-decoration-underline link-underline-primary">Primary underline</Link></p>
                                        <p><Link to="#" className="text-decoration-underline link-underline-secondary">Secondary underline</Link></p>
                                        <p><Link to="#" className="text-decoration-underline link-underline-success">Success underline</Link></p>
                                        <p><Link to="#" className="text-decoration-underline link-underline-danger">Danger underline</Link></p>
                                        <p><Link to="#" className="text-decoration-underline link-underline-warning">Warning underline</Link></p>
                                        <p><Link to="#" className="text-decoration-underline link-underline-info">Info underline</Link></p>
                                        <p><Link to="#" className="text-decoration-underline link-underline-light">Light underline</Link></p>
                                        <p className="mb-0"><Link to="#" className="text-decoration-underline link-underline-dark">Dark underline</Link></p>
                                    </div>

                                    <div className="d-none code-view">
                                        <pre className="language-markup">
                                            <code>
                                                <UnderlineColor />
                                            </code>
                                        </pre>
                                    </div>

                                </CardBody>
                            </Card>
                        </Col>


                        <Col xxl={4}>
                            <Card>
                                <PreviewCardHeader title="Underline opacity" />

                                <CardBody>
                                    <p className="text-muted">Change the underline’s opacity. Requires adding <code>.link-underline</code> to first set an <code>rgba()</code> color we use to then modify the alpha opacity.</p>
                                    <div className="live-preview">
                                        <p><Link className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-0" to="/#">Underline opacity 0</Link></p>
                                        <p><Link className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-10" to="/#">Underline opacity 10</Link></p>
                                        <p><Link className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-25" to="/#">Underline opacity 25</Link></p>
                                        <p><Link className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-50" to="/#">Underline opacity 50</Link></p>
                                        <p><Link className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-75" to="/#">Underline opacity 75</Link></p>
                                        <p className="mb-0"><Link className="link-offset-2 text-decoration-underline link-underline link-underline-opacity-100" to="/#">Underline opacity 100</Link></p>
                                    </div>

                                    <div className="d-none code-view">
                                        <pre className="language-markup">
                                            <code>
                                                <UnderlineOpacity />
                                            </code>
                                        </pre>
                                    </div>

                                </CardBody>
                            </Card>
                        </Col>

                        <Col xxl={4}>
                            <Card>
                                <PreviewCardHeader title="Underline offset" />

                                <CardBody>
                                    <p className="text-muted">Change the underline’s distance from your text. Offset is set in <code>em</code> units to automatically scale with the element’s current <code>font-size</code>.</p>
                                    <div className="live-preview">
                                        <p><Link to="/#">Default link</Link></p>
                                        <p><Link className="text-decoration-underline" to="/#">Offset 1 link</Link></p>
                                        <p><Link className="text-decoration-underline" to="/#">Offset 2 link</Link></p>
                                        <p className="mb-0"><Link className="text-decoration-underline" to="/#">Offset 3 link</Link></p>
                                    </div>

                                    <div className="d-none code-view">
                                        <pre className="language-markup" style={{ height: "275px" }}>
                                            <code>
                                                <UnderlineOffset />
                                            </code>
                                        </pre>
                                    </div>

                                </CardBody>
                            </Card>
                        </Col>
                    </Row>
                </Container>
            </div>
        </React.Fragment >
    );
};

export default UiLink;
