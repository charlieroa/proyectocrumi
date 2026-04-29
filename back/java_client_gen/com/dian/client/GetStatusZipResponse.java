
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
 *         &lt;element name="GetStatusZipResult" type="{http://schemas.datacontract.org/2004/07/DianResponse}ArrayOfDianResponse" minOccurs="0"/>
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
    "getStatusZipResult"
})
@XmlRootElement(name = "GetStatusZipResponse")
public class GetStatusZipResponse {

    @XmlElementRef(name = "GetStatusZipResult", namespace = "http://wcf.dian.colombia", type = JAXBElement.class, required = false)
    protected JAXBElement<ArrayOfDianResponse> getStatusZipResult;

    /**
     * Gets the value of the getStatusZipResult property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfDianResponse }{@code >}
     *     
     */
    public JAXBElement<ArrayOfDianResponse> getGetStatusZipResult() {
        return getStatusZipResult;
    }

    /**
     * Sets the value of the getStatusZipResult property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link ArrayOfDianResponse }{@code >}
     *     
     */
    public void setGetStatusZipResult(JAXBElement<ArrayOfDianResponse> value) {
        this.getStatusZipResult = value;
    }

}
