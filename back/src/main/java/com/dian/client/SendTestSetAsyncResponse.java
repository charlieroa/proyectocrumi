
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlRootElement;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for anonymous complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType>
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="SendTestSetAsyncResult" type="{http://schemas.datacontract.org/2004/07/UploadDocumentResponse}UploadDocumentResponse" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "", propOrder = {
    "sendTestSetAsyncResult"
})
@XmlRootElement(name = "SendTestSetAsyncResponse")
public class SendTestSetAsyncResponse {

    @XmlElementRef(name = "SendTestSetAsyncResult", namespace = "http://wcf.dian.colombia", type = JAXBElement.class, required = false)
    protected JAXBElement<UploadDocumentResponse> sendTestSetAsyncResult;

    /**
     * Gets the value of the sendTestSetAsyncResult property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link UploadDocumentResponse }{@code >}
     *     
     */
    public JAXBElement<UploadDocumentResponse> getSendTestSetAsyncResult() {
        return sendTestSetAsyncResult;
    }

    /**
     * Sets the value of the sendTestSetAsyncResult property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link UploadDocumentResponse }{@code >}
     *     
     */
    public void setSendTestSetAsyncResult(JAXBElement<UploadDocumentResponse> value) {
        this.sendTestSetAsyncResult = value;
    }

}
