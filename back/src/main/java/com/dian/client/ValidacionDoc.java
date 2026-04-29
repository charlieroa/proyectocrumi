
package com.dian.client;

import javax.xml.bind.JAXBElement;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;
import javax.xml.bind.annotation.XmlElementRef;
import javax.xml.bind.annotation.XmlType;


/**
 * <p>Java class for ValidacionDoc complex type.
 * 
 * <p>The following schema fragment specifies the expected content contained within this class.
 * 
 * <pre>
 * &lt;complexType name="ValidacionDoc">
 *   &lt;complexContent>
 *     &lt;restriction base="{http://www.w3.org/2001/XMLSchema}anyType">
 *       &lt;sequence>
 *         &lt;element name="IsNotification" type="{http://www.w3.org/2001/XMLSchema}boolean" minOccurs="0"/>
 *         &lt;element name="IsValida" type="{http://www.w3.org/2001/XMLSchema}boolean" minOccurs="0"/>
 *         &lt;element name="MensajeError" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Nombre" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *         &lt;element name="Status" type="{http://www.w3.org/2001/XMLSchema}string" minOccurs="0"/>
 *       &lt;/sequence>
 *     &lt;/restriction>
 *   &lt;/complexContent>
 * &lt;/complexType>
 * </pre>
 * 
 * 
 */
@XmlAccessorType(XmlAccessType.FIELD)
@XmlType(name = "ValidacionDoc", namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", propOrder = {
    "isNotification",
    "isValida",
    "mensajeError",
    "nombre",
    "status"
})
public class ValidacionDoc {

    @XmlElement(name = "IsNotification")
    protected Boolean isNotification;
    @XmlElement(name = "IsValida")
    protected Boolean isValida;
    @XmlElementRef(name = "MensajeError", namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", type = JAXBElement.class, required = false)
    protected JAXBElement<String> mensajeError;
    @XmlElementRef(name = "Nombre", namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", type = JAXBElement.class, required = false)
    protected JAXBElement<String> nombre;
    @XmlElementRef(name = "Status", namespace = "http://schemas.datacontract.org/2004/07/ValidacionDoc", type = JAXBElement.class, required = false)
    protected JAXBElement<String> status;

    /**
     * Gets the value of the isNotification property.
     * 
     * @return
     *     possible object is
     *     {@link Boolean }
     *     
     */
    public Boolean isIsNotification() {
        return isNotification;
    }

    /**
     * Sets the value of the isNotification property.
     * 
     * @param value
     *     allowed object is
     *     {@link Boolean }
     *     
     */
    public void setIsNotification(Boolean value) {
        this.isNotification = value;
    }

    /**
     * Gets the value of the isValida property.
     * 
     * @return
     *     possible object is
     *     {@link Boolean }
     *     
     */
    public Boolean isIsValida() {
        return isValida;
    }

    /**
     * Sets the value of the isValida property.
     * 
     * @param value
     *     allowed object is
     *     {@link Boolean }
     *     
     */
    public void setIsValida(Boolean value) {
        this.isValida = value;
    }

    /**
     * Gets the value of the mensajeError property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getMensajeError() {
        return mensajeError;
    }

    /**
     * Sets the value of the mensajeError property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setMensajeError(JAXBElement<String> value) {
        this.mensajeError = value;
    }

    /**
     * Gets the value of the nombre property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getNombre() {
        return nombre;
    }

    /**
     * Sets the value of the nombre property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setNombre(JAXBElement<String> value) {
        this.nombre = value;
    }

    /**
     * Gets the value of the status property.
     * 
     * @return
     *     possible object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public JAXBElement<String> getStatus() {
        return status;
    }

    /**
     * Sets the value of the status property.
     * 
     * @param value
     *     allowed object is
     *     {@link JAXBElement }{@code <}{@link String }{@code >}
     *     
     */
    public void setStatus(JAXBElement<String> value) {
        this.status = value;
    }

}
