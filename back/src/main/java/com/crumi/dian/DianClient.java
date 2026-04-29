package com.crumi.dian;

import org.apache.cxf.jaxws.JaxWsProxyFactoryBean;
import org.apache.cxf.ws.security.wss4j.WSS4JOutInterceptor;
import org.apache.wss4j.dom.WSConstants;
import org.apache.wss4j.dom.handler.WSHandlerConstants;
import org.apache.cxf.ext.logging.LoggingFeature;
import javax.xml.namespace.QName;
import javax.xml.ws.Service;
import javax.xml.ws.Dispatch;
import javax.xml.soap.SOAPMessage;
import javax.xml.soap.MessageFactory;
import javax.xml.soap.SOAPBody;
import javax.xml.soap.SOAPElement;
import javax.xml.soap.SOAPEnvelope;
import javax.xml.soap.SOAPHeader;
import javax.xml.soap.SOAPPart;
import javax.xml.soap.SOAPConstants;
import org.apache.cxf.endpoint.Client;
import org.apache.cxf.frontend.ClientProxy;
import org.apache.cxf.jaxws.DispatchImpl;
import org.apache.cxf.endpoint.Endpoint;

import java.util.HashMap;
import java.util.Map;
import java.io.File;
import java.security.KeyStore;

public class DianClient {

    private static final String WCF_NS = "http://wcf.dian.colombia";

    public static void main(String[] args) {
        if (args.length < 5) {
            System.err.println(
                    "Usage: java -jar dian-client.jar <p12Path> <password> <methodName> <xmlBase64> <fileName> [testSetId] [url]");
            System.exit(1);
        }

        String p12Path = args[0];
        String password = args[1];
        String methodName = args[2];
        String xmlBase64 = args[3];
        String fileName = args[4];
        String testSetId = args.length > 5 ? args[5] : "null";
        String targetUrl = args.length > 6 ? args[6] : "https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc";

        try {
            // Load Alias dynamically
            KeyStore ks = KeyStore.getInstance("PKCS12");
            ks.load(new java.io.FileInputStream(p12Path), password.toCharArray());
            String alias = ks.aliases().nextElement();
            System.out.println("Using keystore alias: " + alias);

            // Create Service and Dispatch
            QName serviceName = new QName("http://wcf.dian.colombia", "WcfDianCustomerServices");
            QName portName = new QName("http://wcf.dian.colombia", "IWcfDianCustomerServices");
            Service service = Service.create(serviceName);
            service.addPort(portName, javax.xml.ws.soap.SOAPBinding.SOAP12HTTP_BINDING, targetUrl);

            Dispatch<SOAPMessage> dispatch = service.createDispatch(portName, SOAPMessage.class, Service.Mode.MESSAGE);

            // Build Message manually (early to set namespaces on envelope)
            MessageFactory mf = MessageFactory.newInstance(SOAPConstants.SOAP_1_2_PROTOCOL);
            SOAPMessage request = mf.createMessage();
            SOAPPart soapPart = request.getSOAPPart();

            // Create Envelope with global namespaces to avoid C14N issues in headers
            SOAPEnvelope envelope = soapPart.getEnvelope();
            envelope.addNamespaceDeclaration("wcf", "http://wcf.dian.colombia");
            envelope.addNamespaceDeclaration("wsa", "http://www.w3.org/2005/08/addressing");
            envelope.addNamespaceDeclaration("wsse",
                    "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd");
            envelope.addNamespaceDeclaration("wsu",
                    "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd");

            // Configure Client (Interceptors)
            Client client = ((org.apache.cxf.jaxws.DispatchImpl) dispatch).getClient();
            Endpoint endpoint = client.getEndpoint();

            // WSS4J Security Configuration
            Map<String, Object> outProps = new HashMap<>();
            // Reversing order to try to force Timestamp at top (Strict Layout) if WSS4J
            // prepends
            outProps.put(WSHandlerConstants.ACTION, WSHandlerConstants.SIGNATURE + " " + WSHandlerConstants.TIMESTAMP);
            outProps.put(WSHandlerConstants.USER, alias);
            outProps.put(WSHandlerConstants.PW_CALLBACK_REF, new PasswordCallback(password));

            // Signature Config
            outProps.put(WSHandlerConstants.SIG_PROP_REF_ID, "cryptoProperties");
            outProps.put("cryptoProperties", loadCryptoProperties(p12Path, password, alias));

            outProps.put(WSHandlerConstants.SIG_KEY_ID, "DirectReference"); // Placeholder, overridden below

            // Canonicalization
            outProps.put(WSHandlerConstants.SIG_C14N_ALGO, WSConstants.C14N_EXCL_OMIT_COMMENTS);

            // Algorithms
            outProps.put(WSHandlerConstants.SIG_ALGO, "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256");
            outProps.put(WSHandlerConstants.SIG_DIGEST_ALGO, "http://www.w3.org/2001/04/xmlenc#sha256");
            // Policy requires Thumbprint Reference
            outProps.put(WSHandlerConstants.SIG_KEY_ID, "Thumbprint");
            outProps.put(WSHandlerConstants.INCLUDE_SIGNATURE_TOKEN, "true");

            // Policy Layout: Strict (Implies Timestamp first, then tokens, then signature)
            outProps.put("layout", "Strict"); // Enforcing Strict layout to ensure Timestamp -> BST -> Signature sorting
            outProps.put("precisionInMilliseconds", "false"); // WCF often prefers seconds-only or doesn't care, but
                                                              // strictness matters

            // Parts to Sign - Restore standard WCF set (Timestamp, Body, To, Action,
            // MessageID)
            outProps.put(WSHandlerConstants.SIGNATURE_PARTS,
                    "{Element}{" + WSConstants.WSU_NS + "}Timestamp;" +
                            "{Element}{" + WSConstants.URI_SOAP12_ENV + "}Body;" +
                            "{Element}{http://www.w3.org/2005/08/addressing}To;" +
                            "{Element}{http://www.w3.org/2005/08/addressing}Action;" +
                            "{Element}{http://www.w3.org/2005/08/addressing}MessageID");

            WSS4JOutInterceptor wss4jOut = new WSS4JOutInterceptor(outProps);
            client.getOutInterceptors().add(wss4jOut);

            // Logging
            LoggingFeature logging = new LoggingFeature();
            logging.setPrettyLogging(true);
            logging.initialize(client.getBus());
            client.getBus().getFeatures().add(logging); // Global bus logging

            // Add WS-Addressing Headers manually if CXF doesn't do it automatically via
            // WS-Addressing Feature
            // CXF has WSAddressingFeature. Let's try adding it to Bus?
            // Or simple Manual headers. WSS4J will sign them if we tell it to.
            // For now, let's stick to Body + Timestamp signature which is minimal.
            // If we need Addressing, we can add headers here.

            SOAPHeader header = envelope.getHeader();
            if (header == null)
                header = envelope.addHeader();
            // Basic Addressing
            String soap12EnvNs = "http://www.w3.org/2003/05/soap-envelope";
            String actionUrl = "http://wcf.dian.colombia/IWcfDianCustomerServices/" + methodName;

            SOAPElement action = header.addChildElement("Action", "wsa", "http://www.w3.org/2005/08/addressing");
            action.addTextNode(actionUrl);
            action.addAttribute(new QName(soap12EnvNs, "mustUnderstand", "env"), "1");
            action.addAttribute(
                    new QName("http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd",
                            "Id", "wsu"),
                    "ID-" + java.util.UUID.randomUUID().toString());

            SOAPElement to = header.addChildElement("To", "wsa", "http://www.w3.org/2005/08/addressing");
            to.addTextNode(targetUrl);
            to.addAttribute(new QName(soap12EnvNs, "mustUnderstand", "env"), "1");
            to.addAttribute(
                    new QName("http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd",
                            "Id", "wsu"),
                    "ID-" + java.util.UUID.randomUUID().toString());

            SOAPElement messageId = header.addChildElement("MessageID", "wsa", "http://www.w3.org/2005/08/addressing");
            messageId.addTextNode("urn:uuid:" + java.util.UUID.randomUUID().toString());
            messageId.addAttribute(
                    new QName("http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd",
                            "Id", "wsu"),
                    "ID-" + java.util.UUID.randomUUID().toString());

            SOAPElement replyTo = header.addChildElement("ReplyTo", "wsa", "http://www.w3.org/2005/08/addressing");
            replyTo.addChildElement("Address", "wsa", "http://www.w3.org/2005/08/addressing")
                    .addTextNode("http://www.w3.org/2005/08/addressing/anonymous");

            // Body
            SOAPBody body = envelope.getBody();
            SOAPElement methodElem = body.addChildElement(methodName, "wcf");

            // Manual construction of <wcf:SendTestSetAsync>
            // Note: fileName, contentFile, testSetId are elements inside.
            // Assuming <wcf:fileName> etc.

            methodElem.addChildElement("fileName", "wcf").addTextNode(fileName);
            methodElem.addChildElement("contentFile", "wcf").addTextNode(xmlBase64);

            if (testSetId != null && !testSetId.isEmpty() && !testSetId.equals("null")) {
                methodElem.addChildElement("testSetId", "wcf").addTextNode(testSetId);
            }

            request.saveChanges();

            // Invoke
            SOAPMessage response = dispatch.invoke(request);

            System.out.println("RESPONSE XML:");
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            response.writeTo(baos);
            System.out.println(baos.toString("UTF-8"));

        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static void addHeaderElement(SOAPHeader header, String namespace, String name, String value)
            throws javax.xml.soap.SOAPException {
        // Use prefix wsa
        SOAPElement elem = header.addChildElement(name, "wsa", namespace);
        elem.addTextNode(value);
    }

    private static java.util.Properties loadCryptoProperties(String p12Path, String password, String alias) {
        java.util.Properties props = new java.util.Properties();
        props.put("org.apache.wss4j.crypto.provider", "org.apache.wss4j.common.crypto.Merlin");
        props.put("org.apache.wss4j.crypto.merlin.keystore.type", "PKCS12");
        props.put("org.apache.wss4j.crypto.merlin.keystore.password", password);
        props.put("org.apache.wss4j.crypto.merlin.keystore.alias", alias);
        props.put("org.apache.wss4j.crypto.merlin.keystore.file", p12Path);
        return props;
    }

    public static class PasswordCallback implements javax.security.auth.callback.CallbackHandler {
        private String password;

        public PasswordCallback(String password) {
            this.password = password;
        }

        public void handle(javax.security.auth.callback.Callback[] callbacks)
                throws java.io.IOException, javax.security.auth.callback.UnsupportedCallbackException {
            for (javax.security.auth.callback.Callback callback : callbacks) {
                if (callback instanceof org.apache.wss4j.common.ext.WSPasswordCallback) {
                    org.apache.wss4j.common.ext.WSPasswordCallback pc = (org.apache.wss4j.common.ext.WSPasswordCallback) callback;
                    pc.setPassword(password);
                }
            }
        }
    }
}
