
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.ByteArrayOutputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;
import java.util.UUID;
import java.util.Base64;
import java.util.Date;
import java.text.SimpleDateFormat;
import java.util.TimeZone;
import java.util.List;
import java.util.ArrayList;

import javax.xml.soap.*;
import javax.xml.namespace.QName;
import javax.xml.crypto.dsig.*;
import javax.xml.crypto.dsig.dom.DOMSignContext;
import javax.xml.crypto.dsig.keyinfo.*;
import javax.xml.crypto.dsig.spec.*;
import javax.xml.crypto.XMLStructure;
import javax.xml.crypto.dom.DOMStructure;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;

public class DianSender {

        private static final String WSU_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
        private static final String WSSE_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
        private static final String SOAP_NS = "http://www.w3.org/2003/05/soap-envelope";
        private static final String WSA_NS = "http://www.w3.org/2005/08/addressing";
        private static final String WCF_NS = "http://wcf.dian.colombia";

        public static void main(String[] args) {
                if (args.length < 5) {
                        System.err.println(
                                        "Usage: java DianSender <p12Path> <password> <methodName> <xmlBase64> <fileName> [testSetId] [url]");
                        System.exit(1);
                }

                String p12Path = args[0];
                String password = args[1];
                String methodName = args[2];
                String xmlBase64 = args[3];
                String fileName = args[4];
                String testSetId = args.length > 5 ? args[5] : "null";
                String targetUrl = args.length > 6 ? args[6]
                                : "https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc";

                try {
                        // 1. Load Certificate
                        KeyStore ks = KeyStore.getInstance("PKCS12");
                        ks.load(new FileInputStream(p12Path), password.toCharArray());
                        String alias = ks.aliases().nextElement();
                        PrivateKey privateKey = (PrivateKey) ks.getKey(alias, password.toCharArray());
                        X509Certificate cert = (X509Certificate) ks.getCertificate(alias);

                        // 2. Create SOAP Message (1.2)
                        MessageFactory mf = MessageFactory.newInstance(SOAPConstants.SOAP_1_2_PROTOCOL);
                        SOAPMessage soapMessage = mf.createMessage();
                        SOAPPart soapPart = soapMessage.getSOAPPart();
                        SOAPEnvelope envelope = soapPart.getEnvelope();

                        envelope.addNamespaceDeclaration("wcf", WCF_NS);
                        envelope.addNamespaceDeclaration("wsa", WSA_NS);
                        envelope.addNamespaceDeclaration("wsse", WSSE_NS);
                        envelope.addNamespaceDeclaration("wsu", WSU_NS);

                        // 3. Header - WS-Addressing
                        SOAPHeader header = envelope.getHeader();
                        if (header == null)
                                header = envelope.addHeader();

                        String actionUrl = "http://wcf.dian.colombia/IWcfDianCustomerServices/" + methodName;

                        String toId = "To-" + UUID.randomUUID().toString();
                        String actionId = "Action-" + UUID.randomUUID().toString();
                        String messageIdId = "MsgId-" + UUID.randomUUID().toString();
                        String replyToId = "ReplyTo-" + UUID.randomUUID().toString();

                        String messageIdValue = "urn:uuid:" + UUID.randomUUID().toString();
                        String replyToValue = "http://www.w3.org/2005/08/addressing/anonymous";

                        addHeaderElement(header, WSA_NS, "Action", actionUrl, actionId);
                        addHeaderElement(header, WSA_NS, "To", targetUrl, toId);
                        addHeaderElement(header, WSA_NS, "MessageID", messageIdValue, messageIdId);

                        SOAPElement replyTo = header.addChildElement("ReplyTo", "wsa");
                        replyTo.setAttributeNS(WSU_NS, "wsu:Id", replyToId);
                        SOAPElement address = replyTo.addChildElement("Address", "wsa");
                        address.addTextNode(replyToValue);

                        // 4. Body Content
                        SOAPBody body = envelope.getBody();
                        String bodyId = "Body-" + UUID.randomUUID().toString();
                        body.setAttributeNS(WSU_NS, "wsu:Id", bodyId);

                        SOAPElement methodElem = body.addChildElement(methodName, "wcf");

                        // NOTE: Verified from generated code that it uses JAXBElement<String> mapped to
                        // namespace http://wcf.dian.colombia
                        // So <wcf:fileName> is correct.
                        methodElem.addChildElement("fileName", "wcf").addTextNode(fileName);
                        methodElem.addChildElement("contentFile", "wcf").addTextNode(xmlBase64);

                        if (testSetId != null && !testSetId.isEmpty() && !testSetId.equals("null")) {
                                methodElem.addChildElement("testSetId", "wcf").addTextNode(testSetId);
                        }

                        // 5. Sign (Header + Body + Addressing) - SHA1
                        addSecurityHeader(header, privateKey, cert, bodyId, toId, actionId, messageIdId, replyToId);

                        // 6. Send
                        soapMessage.saveChanges();

                        SOAPConnectionFactory scf = SOAPConnectionFactory.newInstance();
                        SOAPConnection con = scf.createConnection();

                        java.net.URL endpoint = new java.net.URL(targetUrl);

                        SOAPMessage response = con.call(soapMessage, endpoint);

                        System.out.println("RESPONSE XML:");
                        ByteArrayOutputStream baos = new ByteArrayOutputStream();
                        response.writeTo(baos);
                        System.out.println(baos.toString("UTF-8"));

                        con.close();

                } catch (Exception e) {
                        e.printStackTrace();
                        System.exit(1);
                }
        }

        private static void addHeaderElement(SOAPHeader header, String namespace, String name, String value,
                        String wsuId) throws SOAPException {
                SOAPElement elem = header.addChildElement(name, "wsa");
                elem.addTextNode(value);
                if (wsuId != null) {
                        elem.setAttributeNS(WSU_NS, "wsu:Id", wsuId);
                }
        }

        private static void addSecurityHeader(SOAPHeader header, PrivateKey privateKey, X509Certificate cert,
                        String bodyId,
                        String toId, String actionId, String messageIdId, String replyToId) throws Exception {

                SOAPElement security = header.addChildElement("Security", "wsse");
                security.setAttributeNS(SOAP_NS, "soap:mustUnderstand", "1");

                // Timestamp
                String tsId = "TS-" + UUID.randomUUID().toString();
                SOAPElement timestamp = security.addChildElement("Timestamp", "wsu");
                timestamp.setAttributeNS(WSU_NS, "wsu:Id", tsId);

                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date now = new Date();
                Date expiresDate = new Date(now.getTime() + 60000);

                timestamp.addChildElement("Created", "wsu").addTextNode(sdf.format(now));
                timestamp.addChildElement("Expires", "wsu").addTextNode(sdf.format(expiresDate));

                // BinarySecurityToken
                String tokenUuid = UUID.randomUUID().toString();
                String tokenId = "X509-" + tokenUuid;
                SOAPElement binaryToken = security.addChildElement("BinarySecurityToken", "wsse");
                binaryToken.setAttributeNS(WSU_NS, "wsu:Id", tokenId);
                binaryToken.setAttribute("ValueType",
                                "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3");
                binaryToken.setAttribute("EncodingType",
                                "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary");
                binaryToken.addTextNode(Base64.getEncoder().encodeToString(cert.getEncoded()));

                // Signature Factory
                XMLSignatureFactory fac = XMLSignatureFactory.getInstance("DOM");

                List<String> prefixList = new ArrayList<>();
                prefixList.add("soap");
                prefixList.add("wsa");
                prefixList.add("wcf");
                prefixList.add("wsu");

                C14NMethodParameterSpec c14nSpec = new ExcC14NParameterSpec(prefixList);

                CanonicalizationMethod cm = fac.newCanonicalizationMethod(
                                "http://www.w3.org/2001/10/xml-exc-c14n#",
                                c14nSpec);

                // SHA-1 Signature Method
                SignatureMethod sm = fac.newSignatureMethod(
                                "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
                                null);

                // SHA-1 Digest Method
                DigestMethod dm = fac.newDigestMethod("http://www.w3.org/2000/09/xmldsig#sha1", null);

                List<Reference> references = new ArrayList<>();
                List<Transform> transforms = Collections.singletonList(
                                fac.newTransform("http://www.w3.org/2001/10/xml-exc-c14n#",
                                                new ExcC14NParameterSpec(prefixList)));

                String[] ids = { tsId, bodyId, toId, actionId, messageIdId, replyToId };
                for (String id : ids) {
                        if (id != null) {
                                Reference ref = fac.newReference(
                                                "#" + id,
                                                dm, // SHA-1 Digest
                                                transforms,
                                                null,
                                                null);
                                references.add(ref);
                        }
                }

                SignedInfo si = fac.newSignedInfo(cm, sm, references);

                KeyInfoFactory kif = fac.getKeyInfoFactory();
                DOMSignContext dsc = new DOMSignContext(privateKey, security);
                dsc.setDefaultNamespacePrefix("ds");

                Document doc = security.getOwnerDocument();
                Element str = doc.createElementNS(WSSE_NS, "wsse:SecurityTokenReference");
                Element strRef = doc.createElementNS(WSSE_NS, "wsse:Reference");
                strRef.setAttribute("URI", "#" + tokenId);
                strRef.setAttribute("ValueType",
                                "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3");
                str.appendChild(strRef);

                XMLStructure structure = new javax.xml.crypto.dom.DOMStructure(str);
                KeyInfo ki = kif.newKeyInfo(Collections.singletonList(structure));

                XMLSignature signature = fac.newXMLSignature(si, ki);
                signature.sign(dsc);
        }
}
