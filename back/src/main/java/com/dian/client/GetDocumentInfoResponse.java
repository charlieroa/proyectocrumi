
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
 *         &lt;element name="GetDocumentInfoResult" type="{http://schemas.datacontract.org/2004/07/DocumentInfoResponse}DocumentInfoResponse" minOccurs="0"/>
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
    "getDocumentInfoResult"
})
@XmlRootElement(name = "GetDocumentInfoResponse")
public class GetDocumentInfoResponse {

    @XmlElementRef(name = "GetDocumentInfoResult", namespace = "http://wcf.dian.colombia", type = JAXBElement.class, required = false)
    protected JAXBElement<DocumentInfoResponse> getDocumentInfoResult;

    /**
     * Gets the value of the getDocumentInfoResult property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link DocumentInfoResponse }{@code >}
     *     
     */
    public JAXBElement<DocumentInfoResponse> getGetDocumentInfoResult() {
        return getDocumentInfoResult;
    }

    /**
     * Sets the value of the getDocumentInfoResult property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link DocumentInfoResponse }{@code >}
     *     
     */
    public void setGetDocumentInfoResult(JAXBElement<DocumentInfoResponse> value) {
        this.getDocumentInfoResult = value;
    }

}
