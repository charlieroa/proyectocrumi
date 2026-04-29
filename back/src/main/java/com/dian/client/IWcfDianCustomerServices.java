package com.dian.client;

import javax.jws.WebMethod;
import javax.jws.WebParam;
import javax.jws.WebResult;
import javax.jws.WebService;
import javax.xml.bind.annotation.XmlSeeAlso;
import javax.xml.ws.RequestWrapper;
import javax.xml.ws.ResponseWrapper;
import javax.xml.ws.Action;

@WebService(targetNamespace = "http://wcf.dian.colombia", name = "IWcfDianCustomerServices")
@XmlSeeAlso({ ObjectFactory.class })
public interface IWcfDianCustomerServices {

    @WebMethod(operationName = "SendTestSetAsync", action = "http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync")
    @Action(input = "http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsync", output = "http://wcf.dian.colombia/IWcfDianCustomerServices/SendTestSetAsyncResponse")
    @RequestWrapper(localName = "SendTestSetAsync", targetNamespace = "http://wcf.dian.colombia", className = "com.dian.client.SendTestSetAsync")
    @ResponseWrapper(localName = "SendTestSetAsyncResponse", targetNamespace = "http://wcf.dian.colombia", className = "com.dian.client.SendTestSetAsyncResponse")
    @WebResult(name = "SendTestSetAsyncResult", targetNamespace = "http://wcf.dian.colombia")
    public com.dian.client.UploadDocumentResponse sendTestSetAsync(
            @WebParam(name = "fileName", targetNamespace = "http://wcf.dian.colombia") java.lang.String fileName,
            @WebParam(name = "contentFile", targetNamespace = "http://wcf.dian.colombia") byte[] contentFile,
            @WebParam(name = "testSetId", targetNamespace = "http://wcf.dian.colombia") java.lang.String testSetId);
}
