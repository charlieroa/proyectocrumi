
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.cert.X509Certificate;
import java.util.Date;

public class CheckCert {
    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println("Usage: java CheckCert <p12Path> <password>");
            System.exit(1);
        }
        try {
            String p12Path = args[0];
            String password = args[1];

            KeyStore ks = KeyStore.getInstance("PKCS12");
            ks.load(new FileInputStream(p12Path), password.toCharArray());
            String alias = ks.aliases().nextElement();
            X509Certificate cert = (X509Certificate) ks.getCertificate(alias);

            System.out.println("Subject: " + cert.getSubjectDN());
            System.out.println("Issuer: " + cert.getIssuerDN());
            System.out.println("NotBefore: " + cert.getNotBefore());
            System.out.println("NotAfter: " + cert.getNotAfter());
            System.out.println("Algorithm: " + cert.getSigAlgName());

            Date now = new Date();
            if (now.after(cert.getNotAfter())) {
                System.out.println("ERROR: Certificate EXPIRED!");
            } else if (now.before(cert.getNotBefore())) {
                System.out.println("ERROR: Certificate NOT YET VALID!");
            } else {
                System.out.println("Certificate Date Valid.");
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
