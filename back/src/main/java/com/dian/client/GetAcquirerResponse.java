
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
 *         &lt;element name="GetAcquirerResult" type="{http://schemas.datacontract.org/2004/07/Gosocket.Dian.Services.Utils.Common}AdquirienteResponse" minOccurs="0"/>
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
    "getAcquirerResult"
})
@XmlRootElement(name = "GetAcquirerResponse")
public class GetAcquirerResponse {

    @XmlElementRef(name = "GetAcquirerResult", namespace = "http://wcf.dian.colombia", type = JAXBElement.class, required = false)
    protected JAXBElement<AdquirienteResponse> getAcquirerResult;

    /**
     * Gets the value of the getAcquirerResult property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link AdquirienteResponse }{@code >}
     *     
     */
    public JAXBElement<AdquirienteResponse> getGetAcquirerResult() {
        return getAcquirerResult;
    }

    /**
     * Sets the value of the getAcquirerResult property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link AdquirienteResponse }{@code >}
     *     
     */
    public void setGetAcquirerResult(JAXBElement<AdquirienteResponse> value) {
        this.getAcquirerResult = value;
    }

}
