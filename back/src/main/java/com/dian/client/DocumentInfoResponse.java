
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for DocumentInfoResponse complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="DocumentInfoResponse">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="CompressedDocumentInfo" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="DocumentInfo" type="{http://schemas.datacontract.org/2004/07/Documento}ArrayOfDocumento" minOccurs="0"/>
 *         &lt;element name="StatusCode" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="StatusDescription" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "DocumentInfoResponse", namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", propOrder = {
    "compressedDocumentInfo",
    "documentInfo",
    "statusCode",
    "statusDescription"
})
public class DocumentInfoResponse {

    @XmlElementRef(name = "CompressedDocumentInfo", namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", type = JAXBElement.class, required = false)
    protected JAXBElement<String> compressedDocumentInfo;
    @XmlElementRef(name = "DocumentInfo", namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfDocumento> documentInfo;
    @XmlElementRef(name = "StatusCode", namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", type = JAXBElement.class, required = false)
    protected JAXBElement<String> statusCode;
    @XmlElementRef(name = "StatusDescription", namespace = "http://schemas.datacontract.org/2004/07/DocumentInfoResponse", type = JAXBElement.class, required = false)
    protected JAXBElement<String> statusDescription;

    /**
     * Gets the value of the compressedDocumentInfo property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getCompressedDocumentInfo() {
        return compressedDocumentInfo;
    }

    /**
     * Sets the value of the compressedDocumentInfo property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setCompressedDocumentInfo(JAXBElement<String> value) {
        this.compressedDocumentInfo = value;
    }

    /**
     * Gets the value of the documentInfo property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfDocumento }{@code >}
     *     
     */
    public JAXBElement<ArrayOfDocumento> getDocumentInfo() {
        return documentInfo;
    }

    /**
     * Sets the value of the documentInfo property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfDocumento }{@code >}
     *     
     */
    public void setDocumentInfo(JAXBElement<ArrayOfDocumento> value) {
        this.documentInfo = value;
    }

    /**
     * Gets the value of the statusCode property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getStatusCode() {
        return statusCode;
    }

    /**
     * Sets the value of the statusCode property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setStatusCode(JAXBElement<String> value) {
        this.statusCode = value;
    }

    /**
     * Gets the value of the statusDescription property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getStatusDescription() {
        return statusDescription;
    }

    /**
     * Sets the value of the statusDescription property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setStatusDescription(JAXBElement<String> value) {
        this.statusDescription = value;
    }

}
