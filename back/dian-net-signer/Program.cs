using System;
using System.IO;
using System.Security.Cryptography.X509Certificates;
using System.ServiceModel;
using System.ServiceModel.Channels;
using System.ServiceModel.Security;
using System.Xml;
using System.Threading.Tasks;

// Namespace simulado para el contrato WCF
[ServiceContract(Namespace = "http://wcf.dian.colombia")]
public interface IWcfDianCustomerServices
{
    [OperationContract(Action = "http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync", ReplyAction = "http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsyncResponse")]
    System.Threading.Tasks.Task<SendTestSetAsyncResponse> SendTestSetAsync(SendTestSetAsyncRequest request);

    [OperationContract(Action = "http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillAsync", ReplyAction = "http://wcf.dian.colombia/IWcfDianCustomerServices/SendBillAsyncResponse")]
    System.Threading.Tasks.Task<SendBillAsyncResponse> SendBillAsync(SendBillAsyncRequest request);

    [OperationContract(Action = "http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatus", ReplyAction = "http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatusResponse")]
    System.Threading.Tasks.Task<GetStatusResponse> GetStatus(GetStatusRequest request);

    [OperationContract(Action = "http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatusZip", ReplyAction = "http://wcf.dian.colombia/IWcfDianCustomerServices/GetStatusZipResponse")]
    System.Threading.Tasks.Task<GetStatusZipResponse> GetStatusZip(GetStatusZipRequest request);

    [OperationContract(Action = "http://wcf.dian.colombia/IWcfDianCustomerServices/GetNumberingRange", ReplyAction = "http://wcf.dian.colombia/IWcfDianCustomerServices/GetNumberingRangeResponse")]
    System.Threading.Tasks.Task<GetNumberingRangeResponse> GetNumberingRange(GetNumberingRangeRequest request);
}

// --- SendTestSetAsync Contracts ---
[MessageContract(IsWrapped = false)]
public class SendTestSetAsyncRequest { [MessageBodyMember(Name = "SendTestSetAsync", Namespace = "http://wcf.dian.colombia")] public SendTestSetAsyncRequestBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class SendTestSetAsyncRequestBody {
    [System.Runtime.Serialization.DataMember] public string fileName;
    [System.Runtime.Serialization.DataMember] public string contentFile;
    [System.Runtime.Serialization.DataMember] public string testSetId;
}

[MessageContract(IsWrapped = false)]
public class SendTestSetAsyncResponse { [MessageBodyMember(Name = "SendTestSetAsyncResponse", Namespace = "http://wcf.dian.colombia")] public SendTestSetAsyncResponseBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class SendTestSetAsyncResponseBody { [System.Runtime.Serialization.DataMember] public UploadDocumentResponse SendTestSetAsyncResult; }

// --- SendBillAsync Contracts ---
[MessageContract(IsWrapped = false)]
public class SendBillAsyncRequest { [MessageBodyMember(Name = "SendBillAsync", Namespace = "http://wcf.dian.colombia")] public SendBillAsyncRequestBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class SendBillAsyncRequestBody {
    [System.Runtime.Serialization.DataMember] public string fileName;
    [System.Runtime.Serialization.DataMember] public string contentFile;
}

[MessageContract(IsWrapped = false)]
public class SendBillAsyncResponse { [MessageBodyMember(Name = "SendBillAsyncResponse", Namespace = "http://wcf.dian.colombia")] public SendBillAsyncResponseBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class SendBillAsyncResponseBody { [System.Runtime.Serialization.DataMember] public UploadDocumentResponse SendBillAsyncResult; }

// --- GetStatus Contracts ---
[MessageContract(IsWrapped = false)]
public class GetStatusRequest { [MessageBodyMember(Name = "GetStatus", Namespace = "http://wcf.dian.colombia")] public GetStatusRequestBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class GetStatusRequestBody { [System.Runtime.Serialization.DataMember] public string trackId; }

[MessageContract(IsWrapped = false)]
public class GetStatusResponse { [MessageBodyMember(Name = "GetStatusResponse", Namespace = "http://wcf.dian.colombia")] public GetStatusResponseBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class GetStatusResponseBody { [System.Runtime.Serialization.DataMember] public DianResponse GetStatusResult; }

// --- GetStatusZip Contracts ---
[MessageContract(IsWrapped = false)]
public class GetStatusZipRequest { [MessageBodyMember(Name = "GetStatusZip", Namespace = "http://wcf.dian.colombia")] public GetStatusZipRequestBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class GetStatusZipRequestBody { [System.Runtime.Serialization.DataMember] public string trackId; }

[MessageContract(IsWrapped = false)]
public class GetStatusZipResponse { [MessageBodyMember(Name = "GetStatusZipResponse", Namespace = "http://wcf.dian.colombia")] public GetStatusZipResponseBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class GetStatusZipResponseBody { [System.Runtime.Serialization.DataMember] public DianResponse[] GetStatusZipResult; }

[System.Runtime.Serialization.DataContract(Namespace = "http://schemas.datacontract.org/2004/07/DianResponse")]
public class DianResponse
{
    [System.Runtime.Serialization.DataMember] public string IsValid;
    [System.Runtime.Serialization.DataMember] public string StatusCode;
    [System.Runtime.Serialization.DataMember] public string StatusDescription;
    [System.Runtime.Serialization.DataMember] public string StatusMessage;
    [System.Runtime.Serialization.DataMember] public string XmlBase64Bytes;
    [System.Runtime.Serialization.DataMember] public string XmlBytes;
    [System.Runtime.Serialization.DataMember] public string XmlDocumentKey;
    [System.Runtime.Serialization.DataMember] public string[] ErrorMessage;
}


[System.Runtime.Serialization.DataContract(Namespace = "http://schemas.datacontract.org/2004/07/UploadDocumentResponse")]
public class UploadDocumentResponse
{
    [System.Runtime.Serialization.DataMember] public string ErrorMessageList;
    [System.Runtime.Serialization.DataMember] public string ZipKey;
}

// --- GetNumberingRange Contracts ---
[MessageContract(IsWrapped = false)]
public class GetNumberingRangeRequest { [MessageBodyMember(Name = "GetNumberingRange", Namespace = "http://wcf.dian.colombia")] public GetNumberingRangeRequestBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class GetNumberingRangeRequestBody {
    [System.Runtime.Serialization.DataMember] public string accountCode;
    [System.Runtime.Serialization.DataMember] public string accountCodeT;
    [System.Runtime.Serialization.DataMember] public string softwareCode;
}

[MessageContract(IsWrapped = false)]
public class GetNumberingRangeResponse { [MessageBodyMember(Name = "GetNumberingRangeResponse", Namespace = "http://wcf.dian.colombia")] public GetNumberingRangeResponseBody Body; }

[System.Runtime.Serialization.DataContract(Namespace = "http://wcf.dian.colombia")]
public class GetNumberingRangeResponseBody { [System.Runtime.Serialization.DataMember] public NumberingRangeResponse GetNumberingRangeResult; }

[System.Runtime.Serialization.DataContract(Namespace = "http://schemas.datacontract.org/2004/07/DianResponse")]
public class NumberingRangeResponse
{
    [System.Runtime.Serialization.DataMember] public string OperationCode;
    [System.Runtime.Serialization.DataMember] public string OperationDescription;
    [System.Runtime.Serialization.DataMember] public NumberingRange[] ResponseList;
}

[System.Runtime.Serialization.DataContract(Namespace = "http://schemas.datacontract.org/2004/07/DianResponse")]
public class NumberingRange
{
    [System.Runtime.Serialization.DataMember] public string ResolutionNumber;
    [System.Runtime.Serialization.DataMember] public string ResolutionDate;
    [System.Runtime.Serialization.DataMember] public string Prefix;
    [System.Runtime.Serialization.DataMember] public string FromNumber;
    [System.Runtime.Serialization.DataMember] public string ToNumber;
    [System.Runtime.Serialization.DataMember] public string ValidDateFrom;
    [System.Runtime.Serialization.DataMember] public string ValidDateTo;
    [System.Runtime.Serialization.DataMember] public string TechnicalKey;
}

class Program
{
    static async Task Main(string[] args)
    {
        if (args.Length < 5)
        {
            Console.WriteLine("Usage: DianSigner <p12Path> <password> <method> <zipContent(base64)> <fileName> <testSetId> <url>");
            Console.WriteLine("Note: zipContent and url are positional. Assuming testSetId is provided");
            return;
        }

        string p12Path = args[0];
        string password = args[1];
        string method = args[2];
        string zipContent = args[3];
        string fileName = args[4];
        string testSetId = args[5];
        string url = args[6];

        Console.WriteLine($"[C#] Starting WCF Client...");
        Console.WriteLine($"[C#] TestSetID: {testSetId}");
        Console.WriteLine($"[C#] URL: {url}");

        try 
        {
            // Load Certificate
            var cert = new X509Certificate2(p12Path, password, X509KeyStorageFlags.Exportable);
            Console.WriteLine($"[C#] Loaded Cert: {cert.Subject}");

            // Create Binding exactly matching DIAN Policy
            // Policy: TransportBinding (HTTPS) + EndorsingSupportingTokens (X509)
            // This translates to TransportWithMessageCredential or a Custom Binding with AsymmetricSecurity in Mixed Mode
            
            // Standard approach for DIAN:
            // Custom Binding allow us to be precise about 'Strict' layout and IncludeToken params
            var binding = new CustomBinding();

            // 1. Security Element
            // DIAN requirements based on wsdl:
            // - AsymmetricSecurityBindingElement (or TransportSecurityBindingElement with Endorsing)
            // - IncludeTimestamp: True
            // - Layout: Strict
            // - AlgorithmSuite: Basic256Sha256Rsa15
            // - X509Token: IncludeToken.AlwaysToRecipient
            
            // Use TransportSecurityBindingElement because the transport is HTTPS (TransportBinding policy)
            // And add the Certificate as an "Endorsing Supporting Token"
            var security = SecurityBindingElement.CreateCertificateOverTransportBindingElement(MessageSecurityVersion.WSSecurity11WSTrust13WSSecureConversation13WSSecurityPolicy12BasicSecurityProfile10);
            
            // Crucial: DIAN uses Strict Layout
            security.SecurityHeaderLayout = SecurityHeaderLayout.Strict;
            
            // Crucial: Include Timestamp
            security.IncludeTimestamp = true;
            
            // Crucial: Key Identifier - Thumbprint? The WSDL says Thumbprint.
            // .NET defaults to KeyIdentifier for Endorsing. We might need to tweak this if it sends IssuerSerial.
            // But usually CreateCertificateOverTransportBindingElement handles the IncludeToken=AlwaysToRecipient correctly.
            
            security.DefaultAlgorithmSuite = SecurityAlgorithmSuite.Basic256Sha256;

            binding.Elements.Add(security);

            // 2. Encoding Element (SOAP 1.2)
            var encoding = new TextMessageEncodingBindingElement(MessageVersion.Soap12WSAddressing10, System.Text.Encoding.UTF8);
            binding.Elements.Add(encoding);

            // 3. Transport Element (HTTPS)
            var transport = new HttpsTransportBindingElement();
            transport.MaxReceivedMessageSize = 2147483647;
            binding.Elements.Add(transport);

            // Create Endpoint Address
            var endpointAddress = new EndpointAddress(url);

            // Create Channel
            var factory = new ChannelFactory<IWcfDianCustomerServices>(binding, endpointAddress);
            
            // Set Credentials
            factory.Credentials.ClientCertificate.Certificate = cert;
            
            // Add Inspector to capture raw XML (must be added to factory endpoint)
            factory.Endpoint.EndpointBehaviors.Add(new InspectorBehavior());
            
            // Create Client Proxy
            // Create Client Proxy
            var client = factory.CreateChannel();

            if (method == "GetStatus")
            {
                // GetStatus (trackId is passed in args[3] instead of zipContent)
                string trackId = zipContent; // Reusing the argument slot
                var requestBody = new GetStatusRequestBody { trackId = trackId };
                var request = new GetStatusRequest { Body = requestBody };

                Console.WriteLine($"[C#] Invoking GetStatus for TrackID: {trackId}...");
                try 
                {
                    var response = await client.GetStatus(request);
                    // Inspector handles detailed JSON output, but we can print summary logic here if needed
                    if (response != null && response.Body != null && response.Body.GetStatusResult != null)
                    {
                        Console.WriteLine($"[C#] Status Code: {response.Body.GetStatusResult.StatusCode}");
                        Console.WriteLine($"[C#] Status Message: {response.Body.GetStatusResult.StatusMessage}");
                    }
                }
                catch (Exception ex) 
                { 
                    Console.WriteLine("[C#] Exception in GetStatus: " + ex.Message); 
                }
            }
            else if (method == "GetStatusZip")
            {
                // GetStatusZip (trackId is passed in args[3] instead of zipContent)
                string trackId = zipContent; 
                var requestBody = new GetStatusZipRequestBody { trackId = trackId };
                var request = new GetStatusZipRequest { Body = requestBody };

                Console.WriteLine($"[C#] Invoking GetStatusZip for TrackID: {trackId}...");
                try 
                {
                    var response = await client.GetStatusZip(request);
                    if (response != null && response.Body != null && response.Body.GetStatusZipResult != null)
                    {
                        foreach(var res in response.Body.GetStatusZipResult) {
                             Console.WriteLine($"[C#] Status Code: {res.StatusCode}");
                             Console.WriteLine($"[C#] Status Message: {res.StatusMessage}");
                        }
                    }
                }
                catch (Exception ex) 
                { 
                    Console.WriteLine("[C#] Exception in GetStatusZip: " + ex.Message); 
                }
            }
            else if (method == "GetNumberingRange")
            {
                // Nit in args[3] (zipContent), SoftwareID in args[4] (fileName)
                string nit = zipContent;
                string softwareId = fileName;
                
                var requestBody = new GetNumberingRangeRequestBody
                {
                    accountCode = nit,
                    accountCodeT = nit,
                    softwareCode = softwareId
                };
                var request = new GetNumberingRangeRequest { Body = requestBody };
                var response = await client.GetNumberingRange(request);
                
                Console.WriteLine("---NUMBERING_RANGE_START---");
                if (response != null && response.Body != null && response.Body.GetNumberingRangeResult != null)
                {
                     if (response.Body.GetNumberingRangeResult.ResponseList != null)
                     {
                        foreach (var range in response.Body.GetNumberingRangeResult.ResponseList)
                        {
                            Console.WriteLine($"Res: {range.ResolutionNumber} | Pfc: {range.Prefix} | Key: {range.TechnicalKey} | From: {range.FromNumber} | To: {range.ToNumber}");
                        }
                     }
                     else
                     {
                        Console.WriteLine("No ResponseList found.");
                        Console.WriteLine($"OpCode: {response.Body.GetNumberingRangeResult.OperationCode}");
                        Console.WriteLine($"OpDesc: {response.Body.GetNumberingRangeResult.OperationDescription}");
                     }
                }
                else
                {
                     Console.WriteLine("Response or Body is null.");
                }
                Console.WriteLine("---NUMBERING_RANGE_END---");
            }
            else if (method == "SendBillAsync")
            {
                // SendBillAsync (Production)
                // Note: NO TestSetId required
                var requestBody = new SendBillAsyncRequestBody
                {
                    fileName = fileName,
                    contentFile = zipContent
                };
                var request = new SendBillAsyncRequest { Body = requestBody };

                Console.WriteLine("[C#] Invoking SendBillAsync (Production)...");
                try 
                {
                    var response = await client.SendBillAsync(request);
                    // The Inspector handles the output, but we can print here too if needed
                    if (response != null && response.Body != null && response.Body.SendBillAsyncResult != null)
                        Console.WriteLine($"[C#] ZipKey: {response.Body.SendBillAsyncResult.ZipKey}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine("[C#] Exception in SendBillAsync: " + ex.Message);
                }
            }
            else
            {
                // SendTestSetAsync (Habilitation)
                var requestBody = new SendTestSetAsyncRequestBody
                {
                    fileName = fileName,
                    contentFile = zipContent,
                    testSetId = testSetId
                };
                var request = new SendTestSetAsyncRequest { Body = requestBody };

                Console.WriteLine("[C#] Invoking SendTestSetAsync (Habilitation)...");
                try
                {
                    var response = await client.SendTestSetAsync(request);
                    if (response != null && response.Body != null && response.Body.SendTestSetAsyncResult != null)
                        Console.WriteLine($"[C#] ZipKey: {response.Body.SendTestSetAsyncResult.ZipKey}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine("[C#] Exception in SendTestSetAsync: " + ex.Message);
                }
            }

            ((IClientChannel)client).Close();
        }
        catch (Exception ex)
        {
            Console.WriteLine("[C#] CRITICAL ERROR: " + ex.Message);
            if (ex.InnerException != null)
                Console.WriteLine("[C#] Inner: " + ex.InnerException.Message);
        }
    }
}

public class InspectorBehavior : System.ServiceModel.Description.IEndpointBehavior
{
    public void AddBindingParameters(System.ServiceModel.Description.ServiceEndpoint endpoint, System.ServiceModel.Channels.BindingParameterCollection bindingParameters) { }
    public void ApplyClientBehavior(System.ServiceModel.Description.ServiceEndpoint endpoint, System.ServiceModel.Dispatcher.ClientRuntime clientRuntime)
    {
        clientRuntime.ClientMessageInspectors.Add(new XmlInspector());
    }
    public void ApplyDispatchBehavior(System.ServiceModel.Description.ServiceEndpoint endpoint, System.ServiceModel.Dispatcher.EndpointDispatcher endpointDispatcher) { }
    public void Validate(System.ServiceModel.Description.ServiceEndpoint endpoint) { }
}

public class XmlInspector : System.ServiceModel.Dispatcher.IClientMessageInspector
{
// ... (previous code)

    public void AfterReceiveReply(ref System.ServiceModel.Channels.Message reply, object correlationState)
    {
        // Create a buffer to read the message without consuming it
        var buffer = reply.CreateBufferedCopy(int.MaxValue);
        reply = buffer.CreateMessage();
        var msg = buffer.CreateMessage();
        
        var reader = msg.GetReaderAtBodyContents();
        string content = reader.ReadOuterXml();
        Console.WriteLine("[C#] RAW XML RESPONSE: " + content);
        
        // Manual parsing to avoid WCF deserialization headaches with namespaces
        try 
        {
            var doc = new System.Xml.XmlDocument();
            doc.LoadXml(content);
            
            var nsmgr = new System.Xml.XmlNamespaceManager(doc.NameTable);
            nsmgr.AddNamespace("b", "http://schemas.datacontract.org/2004/07/UploadDocumentResponse");
            nsmgr.AddNamespace("c", "http://schemas.datacontract.org/2004/07/XmlParamsResponseTrackId");
            nsmgr.AddNamespace("d", "http://schemas.datacontract.org/2004/07/DianResponse");
            nsmgr.AddNamespace("arr", "http://schemas.microsoft.com/2003/10/Serialization/Arrays");
            
            // --- UploadDocumentResponse nodes (SendTestSet/SendBill) ---
            var zipKeyNode = doc.SelectSingleNode("//b:ZipKey", nsmgr);
            var successNode = doc.SelectSingleNode("//c:Success", nsmgr);
            var messageNode = doc.SelectSingleNode("//c:ProcessedMessage", nsmgr);
            var docKeyNode = doc.SelectSingleNode("//c:DocumentKey", nsmgr);
            
            // --- DianResponse nodes (GetStatus/GetStatusZip) ---
            var isValidNode = doc.SelectSingleNode("//d:IsValid", nsmgr);
            var statusCodeNode = doc.SelectSingleNode("//d:StatusCode", nsmgr);
            var statusMessageNode = doc.SelectSingleNode("//d:StatusMessage", nsmgr);
            var statusXmlKeyNode = doc.SelectSingleNode("//d:XmlDocumentKey", nsmgr); 
            
            // GetStatusZip returns array of DianResponse, usually wrapped in GetStatusZipResult
            // XML structure might be: <GetStatusZipResult><DianResponse>...</DianResponse></GetStatusZipResult>
            // We search for ANY DianResponse structure if not found specific
            if (isValidNode == null) {
                 isValidNode = doc.SelectSingleNode("//d:DianResponse/d:IsValid", nsmgr);
                 statusCodeNode = doc.SelectSingleNode("//d:DianResponse/d:StatusCode", nsmgr);
                 statusMessageNode = doc.SelectSingleNode("//d:DianResponse/d:StatusMessage", nsmgr);
                 // Note: if multiple responses, this only grabs the first one. Sufficient for single invoice test.
            }
            
            // Collect Errors
            string errors = "";
            var errorNodes = doc.SelectNodes("//b:ErrorMessageList/b:XmlParamsResponseTrackId/c:ProcessedMessage", nsmgr);
            if (errorNodes.Count == 0) errorNodes = doc.SelectNodes("//b:ErrorMessageList/b:string", nsmgr);
            // Check GetStatus errors (usually string array)
            if (errorNodes.Count == 0) errorNodes = doc.SelectNodes("//d:ErrorMessage/arr:string", nsmgr);
            if (errorNodes.Count == 0) errorNodes = doc.SelectNodes("//d:ErrorMessage/string", nsmgr); // Fallback

            if (errorNodes != null && errorNodes.Count > 0)
            {
                foreach (XmlNode err in errorNodes)
                {
                    errors += err.InnerText + " | ";
                }
            }

            // Determine values based on what we found
            string zipKey = zipKeyNode?.InnerText ?? "";
            string successStr = "false";
            string message = "";
            string docKey = "";

            if (isValidNode != null)
            {
                // It's a GetStatus response
                successStr = isValidNode.InnerText; // "true" or "false"
                message = statusMessageNode?.InnerText ?? "";
                if (!string.IsNullOrEmpty(errors)) message += " | Errors: " + errors;
                message += $" (StatusCode: {statusCodeNode?.InnerText})";
                docKey = statusXmlKeyNode?.InnerText ?? "";
            }
            else
            {
                // It's an Upload response
                successStr = successNode?.InnerText ?? "false";
                message = messageNode?.InnerText ?? errors;
                docKey = docKeyNode?.InnerText ?? "";

                // Logic for ZipKey success inference
                if (!string.IsNullOrEmpty(zipKey) && successStr == "false" && string.IsNullOrEmpty(errors))
                {
                    successStr = "true";
                }
                if (string.IsNullOrEmpty(docKey) && !string.IsNullOrEmpty(zipKey))
                {
                    docKey = zipKey;
                }
            }

            // Raw content for debugging
            string escapedContent = Escape(content);

            // Create simple JSON output
            string json = $"{{ \"success\": {successStr.ToLower()}, \"message\": \"{Escape(message)}\", \"zipKey\": \"{zipKey}\", \"documentKey\": \"{docKey}\", \"rawXml\": \"{escapedContent}\" }}";
            
            Console.WriteLine("---JSON_START---");
            Console.WriteLine(json);
            Console.WriteLine("---JSON_END---");
        }
        catch (Exception ex)
        {
            Console.WriteLine("XML_PARSE_ERROR: " + ex.Message);
        }
    }

    private string Escape(string s)
    {
        if (s == null) return "";
        return s.Replace("\"", "\\\"").Replace("\r", "").Replace("\n", "");
    }

    public object BeforeSendRequest(ref System.ServiceModel.Channels.Message request, System.ServiceModel.IClientChannel channel)
    {
        return null;
    }
}
